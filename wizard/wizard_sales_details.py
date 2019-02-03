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

from openerp import fields, models, api, _
from openerp.exceptions import Warning, RedirectWarning
from datetime import datetime, date, time, timedelta
from pytz import timezone
from openerp.tools import DEFAULT_SERVER_DATETIME_FORMAT
from openerp import SUPERUSER_ID


class wizard_sales_details(models.TransientModel):
    _name = 'wizard.sales.details'

    @api.model
    def get_ip(self):
        proxy_ip = self.env['res.users'].browse([self._uid]).company_id.report_ip_address or''
        return proxy_ip

    start_date = fields.Date(string="Start Date")
    end_date = fields.Date(string="End Date")
    report_type = fields.Selection([('thermal', 'Thermal'),
                                    ('pdf', 'PDF')], default='pdf', string="Report Type")
    user_ids = fields.Many2many('res.users', 'acespritech_pos_details_report_user_rel', 'user_id', 'wizard_id', 'Salespeople')
    proxy_ip = fields.Char(string="Proxy IP", default=get_ip)
    only_summary = fields.Boolean("Only Summary")

    @api.onchange('start_date', 'end_date')
    def onchange_date(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise Warning(_('End date should be greater than start date.'))

    @api.multi
    def print_sales_details(self):
        datas = {'ids': self._ids,
                 'form': self.read()[0],
                 'model': 'wizard.sales.details'}
        return self.env.ref('flexipharmacy.report_sales_details_pdf').report_action(self, data=datas)

    @api.multi
    def print_pos_sale_action(self):
        if self.start_date > self.end_date:
            raise Warning(_('End date should be greater than start date.'))
        return True

    @api.multi
    def get_currency_id(self):
        user_id = self.env['res.users'].browse([self._uid]);
        if user_id:
            currency_id = user_id.company_id.currency_id;
            return currency_id
        else:
            return

    @api.multi
    def get_current_date(self):
        if self._context and self._context.get('tz'):
            tz_name = self._context['tz']
        else:
            tz_name = self.env['res.users'].browse([self._uid]).tz
        if tz_name:
            tz = timezone(tz_name)
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    @api.multi
    def get_current_time(self):
        if self._context and self._context.get('tz'):
            tz_name = self._context['tz']
        else:
            tz_name = self.env['res.users'].browse([self._uid]).tz
        if tz_name:
            tz = timezone(tz_name)
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')

    @api.multi
    def get_all_users(self):
        user_obj = self.env['res.users']
        return [user.id for user in user_obj.search([])]

    @api.multi
    def get_total_sales(self, user_lst=None):
        if self:
            total_sales = 0.0
            pos_obj = self.env['pos.order']
            user_obj = self.env['res.users']
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            company_id = user_obj.browse([self._uid]).company_id.id
            pos_ids = pos_obj.search([('date_order', '>=', self.start_date + ' 00:00:00'), \
                                      ('date_order', '<=', self.end_date + ' 23:59:59'), \
                                      ('user_id', 'in', user_ids), ('state', 'in', ['done', 'paid', 'invoiced']),
                                      ('company_id', '=', company_id)])
            if pos_ids:
                for pos in pos_ids:
                    for pol in pos.lines:
                        total_sales += (pol.price_unit * pol.qty)
            return total_sales

    @api.multi
    def get_total_returns(self, user_lst=None):
        if self:
            pos_order_obj = self.env['pos.order']
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            user_obj = self.env['res.users']
            company_id = user_obj.browse([self._uid]).company_id.id
            total_return = 0.0
            for pos in pos_order_obj.search([('date_order', '>=', self.start_date + ' 00:00:00'),
                                             ('date_order', '<=', self.end_date + ' 23:59:59'), 
                                             ('user_id', 'in', user_ids), ('state', 'in', ['done', 'paid', 'invoiced']),
                                             ('company_id', '=', company_id)]):
                total_return += pos.amount_total
            return total_return

    @api.multi
    def get_tax_amount(self, user_lst=None):
        if self:
            amount_tax = 0.0
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            pos_order_obj = self.env['pos.order']
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            if pos_ids:
                for order in pos_ids:
                    amount_tax += order.amount_tax
            return amount_tax

    @api.multi
    def get_total_discount(self, user_lst=None):
        if self:
            total_discount = 0.0
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            pos_order_obj = self.env['pos.order']
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            if pos_ids:
                for order in pos_ids:
                    total_discount += sum([((line.qty * line.price_unit) * line.discount) / 100 for line in order.lines])
            return total_discount

    @api.multi
    def get_total_first(self, user_lst=None):
        user_lst = user_lst or []
        if self:
            total = (self.get_total_sales(user_lst) + self.get_tax_amount(user_lst))\
                - (abs(self.get_total_discount(user_lst)))
            return total

    @api.multi
    def get_user(self):
        if self._uid == SUPERUSER_ID:
            return True

    @api.multi
    def get_gross_total(self, user_lst=None):
        if self:
            gross_total = 0.0
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            pos_order_obj = self.env['pos.order']
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            if pos_ids:
                for order in pos_ids:
                    for line in order.lines:
                        gross_total += line.qty * (line.product_id.lst_price - line.product_id.standard_price)
            return gross_total

    @api.multi
    def get_net_gross_total(self, user_lst=None):
        user_lst = user_lst or []
        if self:
            net_gross_profit = 0.0
            net_gross_profit = self.get_gross_total(user_lst) - self.get_tax_amount(user_lst)
            return net_gross_profit

    @api.multi
    def get_product_category(self, user_lst=None):
        if self:
            product_list = []
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            pos_order_obj = self.env['pos.order']
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            if pos_ids:
                for order in pos_ids:
                    for line in order.lines:
                        flag = False
                        product_dict = {}
                        for lst in product_list:
                            if line.product_id.pos_categ_id:
                                if lst.get('pos_categ_id') == line.product_id.pos_categ_id.id:
                                    lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                    flag = True
                            else:
                                if lst.get('pos_categ_id') == '':
                                    lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                    flag = True
                        if not flag:
                            product_dict.update({
                                        'pos_categ_id': line.product_id.pos_categ_id and line.product_id.pos_categ_id.id or '',
                                        'price': (line.qty * line.price_unit)
                                    })
                            product_list.append(product_dict)
            return product_list

    @api.multi
    def get_product_name(self, category_id):
        if category_id:
            category_name = self.env['pos.category'].browse([category_id]).name
            return category_name

    @api.multi
    def get_product_cate_total(self, user_lst=None):
        if self:
            balance_end_real = 0.0
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            pos_order_obj = self.env['pos.order']
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            if pos_ids:
                for order in pos_ids:
                    for line in order.lines:
                        balance_end_real += (line.qty * line.price_unit)
            return balance_end_real

    @api.multi
    def get_payments(self, user_lst=None):
        if self:
            statement_line_obj = self.env["account.bank.statement.line"]
            pos_order_obj = self.env["pos.order"]
            if not user_lst:
                user_ids = [user.id for user in self.user_ids] or self.get_all_users()
            else:
                user_ids = user_lst
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('date_order','>=',self.start_date + ' 00:00:00'),
                                            ('date_order','<=',self.end_date + ' 23:59:59'),
                                            ('state','in',['paid','invoiced','done']),
                                            ('user_id','in',user_ids), ('company_id', '=', company_id)])
            data={}
            if pos_ids:
                pos_ids = [pos.id for pos in pos_ids]
                st_line_ids = statement_line_obj.search([('pos_statement_id', 'in', pos_ids)])
                if st_line_ids:
                    a_l=[]
                    for r in st_line_ids:
                        a_l.append(r['id'])
                    self._cr.execute("select aj.name,sum(amount) from account_bank_statement_line as absl,account_bank_statement as abs,account_journal as aj " \
                                    "where absl.statement_id = abs.id and abs.journal_id = aj.id  and absl.id IN %s " \
                                    "group by aj.name ",(tuple(a_l),))
    
                    data = self._cr.dictfetchall()
                    return data
            else:
                return {}

    @api.multi
    def get_user_wise_data(self):
        user_ids = self.user_ids or self.env['res.users'].search([])
        result = {}
        for user in user_ids:
            result.update({
                user.name: {
                    'total_discount': self.get_total_discount([user.id]),
                    'total_sales': self.get_total_sales([user.id]),
                    'total': self.get_total_returns([user.id]),
                    'taxes': self.get_tax_amount([user.id]),
                    'gross_total': self.get_total_first([user.id]),
                    'gross_profit':self.get_gross_total([user.id]),
                    'net_gross': self.get_net_gross_total([user.id]),
                    'payment': self.get_payments([user.id]),
                    'product_category':self.get_product_category([user.id]),
                    'prod_categ_total':self.get_product_cate_total([user.id]),
                }
            })
        return result

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
