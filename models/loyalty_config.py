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
from odoo import fields, models, api
from datetime import datetime, timedelta
import time


class LoyaltyConfiguration(models.TransientModel):
    _name = 'loyalty.config.settings'
    _inherit = 'res.config.settings'

    @api.model
    def load_loyalty_config_settings(self):
        obj = self.sudo().search([], order='id desc', limit=1)
        if obj:
            fields_config = ['points_based_on', 'minimum_purchase', 'point_calculation', 'points', 'to_amount']
            return obj.read(fields_config)
        return False

# @api.model
# def default_get(self, fieldsname):
# res = super(WebsiteConfig, self).default_get(fieldsname)
# record_id = self.search(([]), order='id desc', limit=1)
# if record_id:
# res.update({'image_layout': record_id.image_layout,
# 'multi_video': record_id.multi_video,
# 'my_purchase': record_id.my_purchase})
# return res

    @api.model
    def default_get(self, fields):
       obj = self.search([], order='id desc', limit=1)
       res = super(LoyaltyConfiguration, self).default_get(fields)
       if obj:
           dc = obj.read()[0]
           del dc["write_uid"],dc["id"],dc["__last_update"],dc["create_date"]
           res.update({
                       'points_based_on': obj.points_based_on,
                       'minimum_purchase': obj.minimum_purchase,
                       'point_calculation': obj.point_calculation,
                       'points': obj.points,
                       'to_amount': obj.to_amount
                       })
       return res

#     @api.model
#     def create(self, values):
# #         if ('company_id' in values and 'currency_id' in values):
# #             company = self.env['res.company'].browse(values.get('company_id'))
# #             if company.currency_id.id == values.get('currency_id'):
# #                 values.pop('currency_id')
# #             if company.accounts_code_digits == values.get('code_digits'):
# #                 values.pop('code_digits')
#         return super(LoyaltyConfiguration, self).create(values)

    points_based_on = fields.Selection([
        ('product', "Product"),
        ('order', "Order")
    ], string="Points Based On",
        help='Loyalty points calculation can be based on products or order')
    minimum_purchase = fields.Float("Minimum Purchase")
    point_calculation = fields.Float("Point Calculation (%)")
    points = fields.Integer("Points")
    to_amount = fields.Float("To Amount")
    
class loyalty_point(models.Model):
    _name = "loyalty.point"
    _order = 'id desc'
    _rec_name = "pos_order_id"

    pos_order_id =  fields.Many2one("pos.order", string="Order", readonly=1)
    partner_id = fields.Many2one('res.partner', 'Member', readonly=1)
    amount_total = fields.Float('Total Amount', readonly=1)
    date = fields.Datetime('Date', readonly=1, default=datetime.now())
    points = fields.Float('Point', readonly=1)


class loyalty_point_redeem(models.Model):
    _name = "loyalty.point.redeem"
    _order = 'id desc'
    _rec_name = "redeemed_pos_order_id"

    redeemed_pos_order_id =  fields.Many2one("pos.order", string="Order")
    partner_id = fields.Many2one('res.partner', 'Member', readonly=1)
    redeemed_amount_total = fields.Float('Redeemed Amount', readonly=1)
    redeemed_date = fields.Datetime('Date', readonly=1, default=datetime.now())
    redeemed_point = fields.Float('Point', readonly=1)


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: