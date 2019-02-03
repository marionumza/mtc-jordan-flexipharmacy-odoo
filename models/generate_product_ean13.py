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

from odoo import models, fields, api, _
from datetime import datetime


class GenerateProductEan13(models.TransientModel):
    _name = 'generate.product.ean13'

    overwrite_ean13 = fields.Boolean(String="Overwrite Exists Ean13")

    @api.multi
    def generate_product_ean13(self):
        for rec in self.env['product.product'].browse(self._context.get('active_ids')):
            if not self.overwrite_ean13 and rec.barcode:
                continue
            rec.write({'barcode': self.env['barcode.nomenclature'].sanitize_ean("%s%s" % (rec.id, datetime.now().strftime("%d%m%y%H%M")))})
        return True

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: