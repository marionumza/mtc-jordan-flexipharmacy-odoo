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

class ResUsers(models.Model):
    _inherit = 'res.users'

    login_with_pos_screen = fields.Boolean(string="Login with Direct POS")
    default_pos = fields.Many2one('pos.config',string="POS Config")
    access_ereceipt = fields.Boolean("E-Receipt", default=True)
    access_quick_cash_payment = fields.Boolean("Quick Cash Payment", default=True)
    access_order_note = fields.Boolean("Order Note", default=True)
    access_product_note = fields.Boolean('Product / Line Note', default=True)
    access_pos_return = fields.Boolean("Return Order/Products", default=True)
    access_reorder = fields.Boolean("Reorder", default=True)
    access_draft_order = fields.Boolean("Draft Order", default=True)
    access_rounding = fields.Boolean("Rounding Total", default=True)
    access_bag_charges = fields.Boolean("Bag Charges", default=True)
    access_delivery_charges = fields.Boolean("Delivery Charges", default=True)
    access_pos_lock = fields.Boolean("POS Screen Lock", default=True)
    access_keyboard_shortcut = fields.Boolean("Keyboard Shortcut", default=True)
    access_product_sync = fields.Boolean("Product Synchronization", default=True)
    access_display_warehouse_qty = fields.Boolean("Display Warehouse Quantity", default=True)
    access_pos_graph = fields.Boolean("POS Graph", default=True)
    access_x_report = fields.Boolean("X-Report", default=True)
    access_pos_loyalty = fields.Boolean("Loyalty", default=True)
    access_today_sale_report = fields.Boolean("Today Sale Report", default=True)
    access_money_in_out = fields.Boolean("Money In/Out", default=True)
    access_print_cash_statement = fields.Boolean('Cash In-Out Statement')
    access_gift_card = fields.Boolean('Gift Card', default=True)
    access_gift_voucher = fields.Boolean('Gift Voucher', default=True)
    access_print_last_receipt = fields.Boolean("Print Last Receipt", default=True)
    access_pos_promotion = fields.Boolean("Promotion", default=True)
    lock_terminal = fields.Boolean("Lock Terminals", default=True)
    delete_msg_log = fields.Boolean("Delete Message Logs", default=True)
    access_show_qty = fields.Boolean("Display Stock", default=True)
    access_print_valid_days = fields.Boolean("Print Product Return Valid days", default=True)
    access_card_charges = fields.Boolean("Card Charges", default=True)
    access_wallet = fields.Boolean("Use Wallet", default=True)
    discard_product = fields.Boolean(string="Discard Product", default=True)
    can_give_discount = fields.Boolean("Give Discount", default=True)
#     can_change_price = fields.Boolean("Change Price", default=True)
    discount_limit = fields.Float("Discount Limit", default=True)
    based_on = fields.Selection([('pin','Pin'),('barcode','Barcode')],
                                   default='barcode',string="Authenticaion Based On")
    access_pos_dashboard = fields.Boolean("POS Sales Dashboard")
    access_product_expiry_report = fields.Boolean("Product Expiry Dashboard")
    shop_ids = fields.Many2many("pos.shop", string='Allow Shop')

    @api.constrains('store_ids')
    def check_location_id(self):
        for shop_id in self.store_ids:
            if shop_id.company_id not in self.company_ids:
                raise Warning(_("Select Shops according to user's company!"))

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: