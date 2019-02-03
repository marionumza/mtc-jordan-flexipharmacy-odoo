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

import datetime
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError,ValidationError

class Pos_promotion(models.Model):
    _name = 'pos.promotion'
    _order = "sequence"
    _rec_name = 'promotion_code'

#     _sql_constraints = [
#         ('promotion_type_unique', 'unique (promotion_type)', """You Can't create multiple rule!"""),
#     ]

    promotion_code = fields.Char('Promotion Code',require=True)
    promotion_type = fields.Selection([('buy_x_get_y','Buy X Get Y Free'),
                                       ('buy_x_get_dis_y','Buy X Get Discount On Y'),
                                       ('dicount_total','Discount (%) on Total Amount'),
                                       ('quantity_discount','Percent Discount on Quantity'),
                                       ('quantity_price','Fix Discount on Quantity'),
                                       ('discount_on_multi_product','Discount On Combination Products'),
                                       ('discount_on_multi_categ','Discount On Multiple Categories'),
                                       ('discount_on_above_price','Discount On Above Price')],
                                      default="buy_x_get_y",require=True)
    from_date = fields.Date('From')
    to_date = fields.Date('To')
    pos_condition_ids = fields.One2many('pos.conditions','pos_promotion_rel')
    pos_quntity_ids = fields.One2many('quantity.discount','pos_quantity_rel')
    pos_quntity_amt_ids = fields.One2many('quantity.discount.amt','pos_quantity_amt_rel')
    pos_quntity_dis_ids = fields.One2many('get.discount','pos_quantity_dis_rel')
    product_id_qty = fields.Many2one('product.product','Product')
    product_id_amt = fields.Many2one('product.product','Product')
    product_id_x_y = fields.Many2one('product.product','Product')
    multi_products_discount_ids = fields.One2many('discount.multi.products','multi_product_dis_rel')
    multi_categ_discount_ids = fields.One2many('discount.multi.categories','multi_categ_dis_rel')
    sequence = fields.Integer(help="Gives the sequence order when displaying a list of promotions.")
    #invoice page
    total_amount = fields.Float('Total Invoice Amount')
    operator = fields.Selection([('is_eql_to','Is Equal To'),
                                 ('greater_than_or_eql','Greater Than Or Equal')])
    total_discount = fields.Float('Total Discount(%)')
    discount_product = fields.Many2one("product.product","Discount Product")
    active = fields.Boolean(default=True)
    parent_product_ids = fields.Many2many(comodel_name='product.product', string="Products")
    discount_price_ids = fields.One2many('discount.above.price','pos_promotion_id')

    @api.constrains('from_date','to_date')
    def date_check(self):
        if self.from_date > self.to_date:
            raise ValidationError("To Date must be greater than From date")

class Conditions_data(models.Model):
    _name='pos.conditions'

    pos_promotion_rel = fields.Many2one('pos.promotion')
    product_x_id = fields.Many2one('product.product','Product(X)')
    operator = fields.Selection([('is_eql_to','Is Equal To'), 
                               ('greater_than_or_eql','Greater Than Or Equal')])
    quantity = fields.Float('Quantity(X)')
    product_y_id = fields.Many2one('product.product','Product(Y)')
    quantity_y = fields.Float('Quantity(Y)')

class quantity_discount(models.Model):
    _name='quantity.discount'

    pos_quantity_rel = fields.Many2one('pos.promotion')
    quantity_dis = fields.Integer('Quantity')
    discount_dis = fields.Float('Discount(%)')

class quantity_discount_amt(models.Model):
    _name='quantity.discount.amt'

    pos_quantity_amt_rel = fields.Many2one('pos.promotion')
    quantity_amt = fields.Integer('Quantity')
    discount_price = fields.Float('Discount Price (Fixed)')

class Get_product_discount(models.Model):
    _name='get.discount'

    pos_quantity_dis_rel = fields.Many2one('pos.promotion')
    product_id_dis = fields.Many2one('product.product','Product')
    discount_dis_x = fields.Float('Discount (%)')

class Discount_On_Multiple_Products(models.Model):
    _name = 'discount.multi.products'

    multi_product_dis_rel = fields.Many2one('pos.promotion')
    products_discount = fields.Float("Discount")
    product_ids = fields.Many2many(comodel_name='product.product', string="Products")

class Discount_On_Multiple_Categories(models.Model):
    _name = 'discount.multi.categories'

    multi_categ_dis_rel = fields.Many2one('pos.promotion')
    categ_discount = fields.Float("Discount")
    categ_ids = fields.Many2many(comodel_name='pos.category', string="Categories")

class Discount_On_Above_Price(models.Model):
    _name = 'discount.above.price'

    pos_promotion_id = fields.Many2one('pos.promotion')
    discount = fields.Float("Discount (%)")
    price = fields.Float("Price")
    product_categ_ids = fields.Many2many('pos.category','discount_pos_categ_rel', string="Categories")
    product_brand_ids = fields.Many2many('product.brand','product_brand_rel', string="Product Brands")

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: