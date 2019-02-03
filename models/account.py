# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

from odoo import models, api, fields, _
from datetime import datetime
from odoo.tools import float_is_zero


class account_journal(models.Model):
    _inherit="account.journal"

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        if self._context.get('config_jr'):
            if self._context.get('journal_ids') and \
               self._context.get('journal_ids')[0] and \
               self._context.get('journal_ids')[0][2]:
               args += [['id', 'in', self._context.get('journal_ids')[0][2]]]
            else:
                return False;
        return super(account_journal, self).name_search(name, args=args, operator=operator, limit=limit)

    shortcut_key = fields.Char('Shortcut Key')
    jr_use_for = fields.Selection([
        ('loyalty', "Loyalty"),
        ('gift_card', "Gift Card"),
        ('gift_voucher', "Gift Voucher"),
        ('rounding', "Rounding")
    ], string="Method Use For",
        help='This payment method reserve for particular feature, that accounting entry will manage based on assigned features.')
    apply_charges = fields.Boolean("Apply Charges");
    fees_amount = fields.Float("Fees Amount");
    fees_type = fields.Selection(selection=[('fixed','Fixed'),('percentage','Percentage')],string="Fees type", default="fixed")
    optional = fields.Boolean("Optional")


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"
 
    @api.one
    @api.constrains('amount')
    def _check_amount(self):
        if not self._context.get('from_pos'):
            super(AccountBankStatementLine, self)._check_amount()

    @api.one
    @api.constrains('amount', 'amount_currency')
    def _check_amount_currency(self):
        if not self._context.get('from_pos'):
            super(AccountBankStatementLine, self)._check_amount_currency()


class AccountPayment(models.Model):
    _inherit = 'account.payment'
    _order = 'id desc'

    @api.model
    def payment(self, get_journal_id, amount, pos_session_id, partner_id, pay_due):
        account_payment_obj = self.env['account.payment']
        pos_order_obj = self.env['pos.order']
        affected_order = []
        if pay_due:
            res = pos_order_obj.search([('partner_id', '=', partner_id), ('state', '=', 'draft')],order='date_order')
            for each in res:
                if amount > 0:
                    if each.amount_due < amount:
                        amount -= each.amount_due
                        values = self.env['pos.make.payment'].with_context(
                            {'active_id': each.id, 'default_journal_id': get_journal_id, 'default_amount':each.amount_due}).default_get(['journal_id', 'amount'])
                        self.env['pos.make.payment'].with_context({'active_id': each.id,'ctx_is_postpaid': True}).create(values).check()

                    elif each.amount_due >= amount:
                        values = self.env['pos.make.payment'].with_context(
                            {'active_id': each.id, 'default_journal_id': get_journal_id,
                             'default_amount': amount}).default_get(['journal_id', 'amount'])
                        self.env['pos.make.payment'].with_context({'active_id': each.id,'ctx_is_postpaid': True}).create(values).check()
                        amount = 0
                        affected_order.append(each.read())
                else:
                    break
        if amount > 0:
            vals = {
                'name': pos_session_id,
                'payment_type': "inbound",
                'amount': amount,
                'payment_date': datetime.now().date(),
                'journal_id': get_journal_id,
                'payment_method_id': 1,
                'partner_type': 'customer',
                'partner_id': partner_id,
            }
            result = account_payment_obj.with_context({'default_from_pos':'credit'}).create(vals)
            result.post()
        res = pos_order_obj.search([('partner_id', '=', partner_id), ('state', '=', 'draft')])
        total_amt_due = 0
        for each in res:
            total_amt_due += each.amount_due
        customer = self.env['res.partner'].search([('id', '=', partner_id)])
        return {'amount_due':total_amt_due,'credit_bal':customer.remaining_credit_amount,'affected_order':affected_order}

    class InvoiceInfo(models.Model):
        _inherit = 'account.invoice'

        @api.model
        def get_outstanding_info(self, vals):
            if (vals):
                partner_id = self.env['res.partner'].browse(vals);
                account_id = partner_id.property_account_receivable_id
                comp_id = self.env['res.partner']._find_accounting_partner(partner_id).id;
                domain = [('account_id', '=', account_id.id),
                          ('partner_id', '=', self.env['res.partner']._find_accounting_partner(partner_id).id),
                          ('reconciled', '=', False), '|', ('amount_residual', '!=', 0.0),
                          ('amount_residual_currency', '!=', 0.0)]
                domain.extend([('credit', '>', 0), ('debit', '=', 0)])
                type_payment = _('Outstanding credits')
                lines = self.env['account.move.line'].search(domain)
                info = {'title': '', 'outstanding': True, 'content': [], 'invoice_id': self.id}
                if len(lines) != 0:
                    for line in lines:
                        if line.currency_id and line.currency_id == self.currency_id:
                            amount_to_show = abs(line.amount_residual_currency)
                        else:
                            amount_to_show = line.company_id.currency_id.with_context(date=line.date).compute(
                                abs(line.amount_residual), self.currency_id)
                        if float_is_zero(amount_to_show, precision_rounding=self.currency_id.rounding):
                            continue
                        info['content'].append({
                            'journal_name': line.ref or line.move_id.name,
                            'amount': amount_to_show,
                            'id': line.id,
                        })
                    info['title'] = type_payment
            return info

        @api.model
        def get_credit_info(self, vals):
            lines_info = []
            move_line_obj = self.env['account.move.line']
            if vals:
                for each in vals:
                    if each['partner_id']:
                        partner_id = self.env['res.partner'].browse(each['partner_id']);
                    credit_aml = self.env['account.move.line'].browse(each['journal_id'])
                    move_line_obj |= credit_aml
                    credit_journal_id = credit_aml.journal_id.default_credit_account_id
                    debit_account_id = credit_aml.journal_id.default_debit_account_id
                    account_id = partner_id.property_account_receivable_id
                    lines_info.append((0, 0, {'account_id': account_id.id,
                                              'debit': each['amount'],
                                              'partner_id': partner_id.id,
                                              }))
                    lines_info.append((0, 0, {'account_id': credit_journal_id.id,
                                              'credit': each['amount'],
                                              'partner_id': partner_id.id,
                                              }))

                    move = self.env['account.move'].create({'ref': '',
                                                            'journal_id': credit_aml.payment_id.journal_id.id,
                                                            'line_ids': lines_info,
                                                            })
                    lines_info = []
                    line_id = move.line_ids.filtered(
                        lambda l: l.account_id.id == account_id.id and l.partner_id.id == partner_id.id)
                    self.env['account.partial.reconcile'].create(
                        {'credit_move_id': credit_aml.id, 'debit_move_id': line_id.id,
                         'amount': line_id.debit,
                         })
                    move.post()
            return True

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
