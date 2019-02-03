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

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        res.update(
            google_api_key = self.env['ir.config_parameter'].sudo().get_param('google_api_key'),
            theme_selector = self.env['ir.config_parameter'].sudo().get_param('theme_selector'),
            gen_ean13 = self.env['ir.config_parameter'].sudo().get_param('gen_ean13')
        )
        return res

    def set_values(self):
        res = super(ResConfigSettings, self).set_values()
        self.env['ir.config_parameter'].sudo().set_param('google_api_key', self.google_api_key or '')
        self.env['ir.config_parameter'].sudo().set_param('theme_selector', self.theme_selector or False)
        self.env['ir.config_parameter'].sudo().set_param('gen_ean13', self.gen_ean13 or '')
        return res

    google_api_key = fields.Char('Google API key')
    theme_selector = fields.Selection([('blue-green','Blue Green'),('purple-pink','Purple Pink')])
    gen_ean13 = fields.Boolean("On Product create generate EAN13")


class res_company(models.Model):
    _inherit = "res.company"

    pos_price = fields.Char(string="Pos Price", size=1)
    pos_quantity = fields.Char(string="Pos Quantity", size=1)
    pos_discount = fields.Char(string="Pos Discount", size=1)
    pos_search = fields.Char(string="Pos Search", size=1)
    pos_next = fields.Char(string="Pos Next order", size=1)
    payment_total = fields.Char(string="Payment", size=1)
    report_ip_address = fields.Char(string="Thermal Printer Proxy IP")
    shop_ids = fields.Many2many("pos.shop", 'pos_shop_company_rel', 'shop_id', 'company_id', string='Allow Shops')

    @api.one
    def write(self, vals):
        current_shop_ids = self.shop_ids
        res = super(res_company, self).write(vals)
        if 'shop_ids' in vals:
            current_shop_ids -= self.shop_ids
            for shop in current_shop_ids:
                shop.company_id = False
            for shop in self.shop_ids:
                shop.company_id = self
        return res

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: