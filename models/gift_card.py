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

import logging
from odoo import models, fields, api, _ 
import time, datetime
_logger = logging.getLogger(__name__)


class aspl_gift_card(models.Model):
    _name = 'aspl.gift.card'
    _rec_name = 'card_no'


    @api.model
    def _send_mail_balance_and_expired_coupon(self, expired=False, balance=False):
        mail_obj = self.env['mail.mail']
        today = fields.Date.today()
        this_week_end_date = fields.Date.to_string(fields.Date.from_string(today) + datetime.timedelta(days=7))
        gift_card_ids = self.search([('expire_date', '=', this_week_end_date)])
        template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy',
                                                   'email_template_for_coupon_expire_7')
        balance_template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy',
                                                   'email_template_regarding_balance')
        if expired:
            for gift_card in gift_card_ids:
                if template_id and template_id[1]:
                    try:
                        template_obj1 = self.env['mail.template'].browse(template_id[1])
                        template_obj1.send_mail(gift_card.id, force_send=True, raise_exception=True)
                    except Exception as e:
                        _logger.error('Unable to send email for order %s',e)
        if balance:
            for gift_card in self.search([]):
                if balance_template_id and balance_template_id[1]:
                    try:
                        template_obj2 = self.env['mail.template'].browse(balance_template_id[1])
                        template_obj2.send_mail(gift_card.id, force_send=True, raise_exception=True)
                    except Exception as e:
                        _logger.error('Unable to send email for order %s',e)

    def random_cardno(self):
        return int(time.time())

    card_no = fields.Char(string="Card No", default=random_cardno, readonly=True)
    card_value = fields.Float(string="Card Value")
    card_type = fields.Many2one('aspl.gift.card.type', string="Card Type")
    customer_id = fields.Many2one('res.partner', string="Customer")
    issue_date = fields.Date(string="Issue Date", default=datetime.datetime.now())
    expire_date = fields.Date(string="Expire Date")
    is_active = fields.Boolean('Active', default=True)
    used_line = fields.One2many('aspl.gift.card.use', 'card_id', string="Used Line")
    recharge_line = fields.One2many('aspl.gift.card.recharge', 'card_id', string="Recharge Line")

    @api.multi
    def write(self, vals):
        mail_obj = self.env['mail.mail']
        res = super(aspl_gift_card, self).write(vals)
        if vals.get('card_no'):
            try:
                template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy',
                                                       'email_template_exchange_number')
                if template_id and template_id[1]:
                   template_obj = self.env['mail.template'].browse(template_id[1])
                   template_obj.send_mail(self.id, force_send=True, raise_exception=True)
            except Exception as e:
                _logger.error('Unable to send email for order %s',e)
        return res


class aspl_gift_card_use(models.Model):
    _name = 'aspl.gift.card.use'
    _rec_name = 'pos_order_id'

    card_id = fields.Many2one('aspl.gift.card', string="Card", readonly=True)
    customer_id = fields.Many2one('res.partner', string = "Customer")
    pos_order_id = fields.Many2one("pos.order", string = "Order")
    order_date = fields.Date(string = "Order Date")
    amount = fields.Float(string = "Amount")

    @api.model
    def create(self, vals):
        res = super(aspl_gift_card_use, self).create(vals)
        mail_obj = self.env['mail.mail']
        if res.pos_order_id:
            try:
                template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy',
                                                       'email_template_regarding_card_use')
                if template_id and template_id[1]:
                   template_obj = self.env['mail.template'].browse(template_id[1])
                   template_obj.send_mail(res.id, force_send=True, raise_exception=True)
            except Exception as e:
                _logger.error('Unable to send email for order %s',e)
        return res


class aspl_gift_card_recharge(models.Model):
    _name = 'aspl.gift.card.recharge'
    _rec_name = 'amount'

    card_id = fields.Many2one('aspl.gift.card', string="Card", readonly=True)
    customer_id = fields.Many2one('res.partner', string="Customer")
    recharge_date = fields.Date(string="Recharge Date")
    user_id = fields.Many2one('res.users', string="User")
    amount = fields.Float(string="amount")


class aspl_gift_card_type(models.Model):
    _name = 'aspl.gift.card.type'
    _rec_name = 'name'

    name = fields.Char(string="Name")
    code = fields.Char(string=" Code")

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: