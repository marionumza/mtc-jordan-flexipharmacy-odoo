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

from openerp import models, fields, api, _
import pytz
from pytz import timezone
from datetime import datetime, date, timedelta


class stock_warehouse(models.Model):
    _inherit = 'stock.warehouse'

    @api.model
    def disp_prod_stock(self, product_id, shop_id):
        stock_line = []
        total_qty = 0
        shop_qty = 0
        quant_obj = self.env['stock.quant']
        for warehouse_id in self.search([]):
            product_qty = 0.0
            ware_record = warehouse_id
            location_id = ware_record.lot_stock_id.id
            if shop_id:
                loc_ids1 = self.env['stock.location'].search(
                    [('location_id', 'child_of', [shop_id])])
                stock_quant_ids1 = quant_obj.search([('location_id', 'in', [
                                                    loc_id.id for loc_id in loc_ids1]), ('product_id', '=', product_id)])
                for stock_quant_id1 in stock_quant_ids1:
                    shop_qty = stock_quant_id1.quantity

            loc_ids = self.env['stock.location'].search(
                [('location_id', 'child_of', [location_id])])
            stock_quant_ids = quant_obj.search([('location_id', 'in', [
                                               loc_id.id for loc_id in loc_ids]), ('product_id', '=', product_id)])
            for stock_quant_id in stock_quant_ids:
                product_qty += stock_quant_id.quantity
            stock_line.append([ware_record.name, product_qty,ware_record.lot_stock_id.id])
            total_qty += product_qty
        return stock_line, total_qty, shop_qty


class stock_picking(models.Model):
    _inherit = "stock.picking"

    @api.model
    def do_detailed_discard_product(self, vals):
        move_lines = []
        line = []
        if vals and vals.get('data'):
            for move_line in vals.get('data').get('moveLines'):
                move_line_dict = {
                    'product_uom_id': move_line.get('product_uom'),
                    'product_id': move_line.get('product_id'),
                    'qty_done': move_line.get('product_uom_qty'),
                    'location_id': move_line.get('location_id'),
                    'location_dest_id': move_line.get('location_dest_id'),
                }
                line.append((0,0,move_line_dict))
                move_lines.append((0,0,move_line))
            picking_id = self.create({
                'location_id': vals.get('data').get('location_src_id'),
                'location_dest_id': vals.get('data').get('location_dest_id'),
                'move_type': 'direct',
                'picking_type_id':vals.get('data').get('picking_type_id'),
                'move_line_ids': line,
                'move_lines': move_lines
            })
            picking_id.action_assign()
            if picking_id:
                if vals.get('data').get('state') == 'done':
                    picking_id.action_confirm()
                    picking_id.force_assign()
                    picking_id.button_validate()
                    stock_transfer_id = self.env['stock.immediate.transfer'].search([('pick_ids', '=', picking_id.id)], limit=1)
                    if stock_transfer_id:
                        stock_transfer_id.process()
        return [picking_id.id,picking_id.name]


class stock_location(models.Model):
    _inherit = 'stock.location'

    category_ids = fields.Many2many("pos.category", string="Category")
    product_ids = fields.Many2many("product.product", string="Product")

    @api.multi
    def get_warehouse_expiry_detail(self,company_id):
        warehouse_near_expire = []
        warehouse_deatil = self.env['stock.warehouse'].search([('company_id', '=', company_id)])
        for each in warehouse_deatil:
            warehouse_location = self.search([('id', '=', each.lot_stock_id.id)])
            stock_detail = self.env['stock.quant'].search([('location_id', '=', warehouse_location.id)])
            if stock_detail:
                near_expire_count = 0
                warehouse_id = False
                for each_stock_count in stock_detail:
                    if each_stock_count.state_check == 'near_expired':
                        near_expire_count += each_stock_count.quantity
                        location_id = each_stock_count.location_id.id
                        warehouse_name = each.name
                        warehouse_id = each.id
                if near_expire_count:
                    warehouse_near_expire.append({'location_id': location_id,
                                                  'expire_count': near_expire_count,
                                                  'warehouse_name': warehouse_name,
                                                  'warehouse_id':warehouse_id})
        return warehouse_near_expire

    @api.multi
    def get_location_detail(self, company_id):
        location_near_expire = []
        location_details = self.search([('usage', '=', 'internal'),('company_id','=',company_id)])
        for each in location_details:
            stock_detail = self.env['stock.quant'].search([('location_id', '=', each.id)])
            if stock_detail:
                near_expire_count = 0
                for each_stock_count in stock_detail:
                    if each_stock_count.state_check == 'near_expired':
                        near_expire_count += each_stock_count.quantity
                        stock_name = each.location_id.name + "/" + each_stock_count.location_id.name
                        location_id = each_stock_count.location_id.id
                if near_expire_count:
                    location_near_expire.append({'location_id': location_id, 'location_name': stock_name,
                                      
                                                 'expire_count': near_expire_count})
        return location_near_expire

    @api.multi
    def get_current_date_x(self):
        if self.env.user.tz:
            tz = timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    @api.multi
    def get_current_time_x(self):
        if self.env.user.tz:
            tz = timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')

    @api.multi
    def get_inventory_details(self):
        product_category = self.env['product.category'].search([])
        product_product = self.env['product.product']
        pos_order = self.env['pos.order'].search([])
        inventory_records = []
        final_list = []
        product_details = []
        for order in pos_order:
            if order.location_id.id == self.id:
                for line in order.lines:
                    product_details.append({
                        'id': line.product_id.id,
                        'qty': line.qty,
                    })
        custom_list = []
        for each_prod in product_details:
            if each_prod.get('id') not in [x.get('id') for x in custom_list]:
                custom_list.append(each_prod)
            else:
                for each in custom_list:
                    if each.get('id') == each_prod.get('id'):
                        each.update({'qty': each.get('qty') + each_prod.get('qty')})
        if custom_list:
            for each in custom_list:
                product_id = product_product.browse(each.get('id'))
                inventory_records.append({
                    'product_id': [product_id.id, product_id.name],
                    'category_id': [product_id.id, product_id.categ_id.name],
                    'used_qty': each.get('qty'),
                    'quantity': product_id.with_context({'location': self.id, 'compute_child': False}).qty_available,
                    'uom_name': product_id.uom_id.name or ''
                })
            if inventory_records:
                temp_list = []
                temp_obj = []
                for each in inventory_records:
                    if each.get('product_id')[0] not in temp_list:
                        temp_list.append(each.get('product_id')[0])
                        temp_obj.append(each)
                    else:
                        for rec in temp_obj:
                            if rec.get('product_id')[0] == each.get('product_id')[0]:
                                qty = rec.get('quantity') + each.get('quantity');
                                rec.update({'quantity': qty})
                final_list = sorted(temp_obj, key=lambda k: k['quantity'])
        return final_list or []

    @api.model
    def filter_location_wise_product(self, location_id):
        location_id = int(location_id)
        if location_id:
            location_name = self.env['stock.location'].browse(location_id).display_name
        list_product = self.env['product.product'].with_context({'location': location_id}). \
            search([('available_in_pos', '=', True), ('type', '=', 'product')])
        all_products = []
        for product in list_product:
            stock = self.env['stock.quant'].search([('product_id', '=', product.id),
                                                    ('location_id', '=', location_id)])
            if stock:
                for each_stock in stock:
                    if each_stock.quantity <= 0.00:
                        all_products.append(each_stock.product_id.id)
            else:
                all_products.append(product.id)
        return {location_name: all_products}


class StockQuantity(models.Model):
    _inherit = 'stock.quant'

    state_check = fields.Selection(related='lot_id.state_check', string="state", store=True)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: