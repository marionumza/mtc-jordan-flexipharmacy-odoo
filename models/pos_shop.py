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

from odoo import fields,api,models,_
from odoo.exceptions import Warning


class PosSHOP(models.Model):
    _name = 'pos.shop'

    name = fields.Char(string='Name',required=True)
    image = fields.Binary(string='Image')
    store_manager = fields.Many2one("res.users",string="Store Manager")
    location_id = fields.Many2one("stock.location",string='Location',required=True)
    street = fields.Char(string='Street')
    street2 = fields.Char(string='Street2')
    website = fields.Char(string='Website')
    zip = fields.Char(string='Zip')
    city = fields.Char(string='City')
    state_id = fields.Many2one("res.country.state", string='State')
    country_id = fields.Many2one('res.country', string='Country')
    email = fields.Char(string='Email')
    phone = fields.Char(string='Phone')
    fax = fields.Char(string='Fax')
    mobile = fields.Char(string='Mobile')
    description = fields.Text(string="Description")
    company_id = fields.Many2one('res.company',string="Company")

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        if self._context.get('company_ids'):
            company_ids = self.env['res.company'].browse(self._context.get('company_ids')[0][2])
            shop_ids = []
            for company in company_ids:
                shop_ids += company.shop_ids.ids
            args += [('id', 'in', shop_ids)]
        return super(PosSHOP, self).name_search(name, args=args, operator=operator, limit=limit)

    @api.onchange('location_id')
    def onchange_location(self):
        if self.location_id:
            self.company_id = self.location_id.company_id

    @api.constrains('location_id')
    def check_location_id(self):
        count_id = self.search_count([('location_id','=',self.location_id.id)])
        if count_id > 1:
            raise Warning(_('This Location is already selected in another shop!'))

    @api.constrains('email')
    def check_email_id(self):
        email_id = self.search_count([('email', '=', self.email),('email','!=','')])
        if email_id > 1:
            raise Warning(_('This email id is already existing!'))

#vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
