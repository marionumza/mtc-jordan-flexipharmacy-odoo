# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
# You should have received a copy of the License along with this program.
#################################################################################

from odoo import models,fields,api,_
from odoo.exceptions import Warning
import datetime
import time

class aspl_gift_voucher(models.Model):
    _name = 'aspl.gift.voucher'
    _rec_name = 'voucher_name'

    @api.model
    def create(self,vals):
        if vals.get('minimum_purchase') <= 0:
            raise Warning(_('Minimum purchase should not be less then 0 amount'))

        if vals.get('minimum_purchase') >= vals.get('voucher_amount'):
            # sequence_code = self.env['ir.sequence'].next_by_code('aspl.gift.voucher')
            sequence_code = self.random_cardno()
            vals.update({'voucher_code':sequence_code})
            res = super(aspl_gift_voucher,self).create(vals)
            return res
        else:
            raise Warning(_('Please make a purchase aleast voucher amount'))

    def random_cardno(self):
        return int(time.time())

    def write(self,vals):
        if (vals.get('minimum_purchase') or self.minimum_purchase) >= (vals.get('voucher_amount') or self.voucher_amount):
            vals.update({'minimum_purchase':vals.get('minimum_purchase') or self.minimum_purchase})
            res = super(aspl_gift_voucher,self).write(vals)
        else:
            raise Warning(_('Please make a purchase aleast voucher amount'))
        return res

    voucher_name = fields.Char(string="Name")
    voucher_code = fields.Char(string="Code", readonly=True)
    voucher_amount = fields.Float(string="Amount")
    minimum_purchase = fields.Float(string="Minimum Purchase")
    expiry_date = fields.Date(string="Expiry Date")
    redemption_order = fields.Integer(string="Redemption Order")
    redemption_customer = fields.Integer(string="Redemption Customer")
    redeem_voucher_ids = fields.One2many('aspl.gift.voucher.redeem', 'voucher_id', string="Redeem")
    
    _sql_constraints = [
      ('unique_name','UNIQUE(voucher_code)',
       'You can only add one time each Barcode.')
    ]


class aspl_gift_voucher_redeem(models.Model):
    _name = 'aspl.gift.voucher.redeem'
    _rec_name = 'voucher_id'
   
    voucher_id = fields.Many2one('aspl.gift.voucher', string="Voucher", readonly=True)
    voucher_code = fields.Char(string="Code", readonly=True)
    order_name = fields.Char(string="Order", readonly=True)
    order_amount = fields.Float(string="Order Amount", readonly=True)
    voucher_amount = fields.Float(string="Voucher Amount", readonly=True)
    used_date = fields.Datetime(string="Used Date", readonly=True, default=fields.Datetime.now(), store=True)
    user_id = fields.Many2one("res.users", string="Sales Person", readonly=True)
    customer_id = fields.Many2one("res.partner", string="Customer", readonly=True)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: