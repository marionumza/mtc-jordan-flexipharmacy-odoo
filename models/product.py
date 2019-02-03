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

from odoo import models, api, fields, _
from datetime import datetime, date, timedelta
from itertools import groupby
import copy


class ProductTemplate(models.Model):
    _inherit = "product.template"

    @api.model
    def create(self, vals):
        res = super(ProductTemplate, self).create(vals)
        if res:
            if not vals.get('barcode') and self.env['ir.config_parameter'].sudo().get_param('gen_ean13'):
                barcode_str = self.env['barcode.nomenclature'].sanitize_ean("%s%s" % (res.id, datetime.now().strftime("%d%m%y%H%M")))
                res.write({'barcode': barcode_str})
        return res
    
    @api.model
    def create_from_ui(self, product):
        if product.get('image'):
            product['image'] = product['image'].split(',')[1]
        id = product.get('id')
        if id:
            product_tmpl_id = self.env['product.product'].browse(id).product_tmpl_id
            if product_tmpl_id:
                product_tmpl_id.write(product)
        else:
            id = self.env['product.product'].create(product).id
        return id
    
    is_packaging = fields.Boolean("Is Packaging")
    loyalty_point = fields.Integer("Loyalty Point")
    is_dummy_product = fields.Boolean("Is Dummy Product")

class ProductProduct(models.Model):
    _inherit = "product.product"

    near_expire = fields.Integer(string='Near Expire', compute='check_near_expiry')
    expired = fields.Integer(string='Expired', compute='check_expiry')

    @api.model
    def create(self, vals):
        res = super(ProductProduct, self).create(vals)
        if res:
            if not vals.get('barcode') and self.env['ir.config_parameter'].sudo().get_param('gen_ean13'):
                barcode_str = self.env['barcode.nomenclature'].sanitize_ean("%s%s" % (res.id, datetime.now().strftime("%d%m%y%H%M")))
                res.write({'barcode': barcode_str})
        return res

    @api.model
    def calculate_product(self, config_id):
        user_allowed_company_ids = self.env.user.company_ids.ids
        config = self.env['pos.config'].browse(config_id)
        product_ids = False
        setting = self.env['res.config.settings'].search([], order='id desc', limit=1, offset=0)
        pos_session = self.env['pos.session'].search([('config_id', '=', config.id), ('state', '=', 'opened')], limit=1)
        if pos_session and config.multi_shop_id and pos_session.shop_id:
            product_ids = pos_session.get_products_category_data(config_id)
            return product_ids
        else:
            if setting and setting.group_multi_company and not setting.company_share_product:
                product_ids = self.with_context({'location': config.stock_location_id.id}).search(
                    [('product_tmpl_id.sale_ok', '=', True), ('active', '=', True),
                     ('product_tmpl_id.active', '=', True),
                     '|', ('product_tmpl_id.company_id', 'in', user_allowed_company_ids),
                     ('product_tmpl_id.company_id', '=', False),
                     ('available_in_pos', '=', True)])
            else:
                product_ids = self.with_context({'location': config.stock_location_id.id}).search(
                    [('product_tmpl_id.sale_ok', '=', True), ('active', '=', True),
                     ('product_tmpl_id.active', '=', True),
                     ('available_in_pos', '=', True)])
        if product_ids:
            return product_ids.ids
        else:
            return []

    def get_current_company(self):
        current_user = self.env.user.id
        user_id = self.env['res.users'].search([('id', '=', int(current_user))])
        return user_id.company_id.id

    def get_near_expiry(self):
        stock_production_lot_obj = self.env['stock.production.lot']
        if self.tracking != 'none':
            today_date = date.today()
            stock_lot = stock_production_lot_obj.search([('product_id', 'in', self.ids)])
            for each_stock_lot in stock_lot.filtered(lambda l: l.alert_date):
                alert_date = datetime.strptime(each_stock_lot.alert_date, '%Y-%m-%d %H:%M:%S').date()
                if each_stock_lot.life_date:
                    life_date = datetime.strptime(each_stock_lot.life_date, '%Y-%m-%d %H:%M:%S').date()
                    if life_date >= today_date:
                        stock_production_lot_obj |= each_stock_lot
        return stock_production_lot_obj

    def get_expiry(self):
        stock_production_lot_obj = self.env['stock.production.lot']
        if self.tracking != 'none':
            today_date = date.today()
            stock_lot = self.env['stock.production.lot'].search([('product_id', 'in', self.ids)])
            for each_stock_lot in stock_lot.filtered(lambda l: l.life_date):
                life_date = datetime.strptime(each_stock_lot.life_date, '%Y-%m-%d %H:%M:%S').date()
                if life_date <= today_date:
                    stock_production_lot_obj |= each_stock_lot
        return stock_production_lot_obj

    @api.one
    def check_near_expiry(self):
        stock_production_lot_obj = self.get_near_expiry()
        self.near_expire = len(stock_production_lot_obj)

    @api.one
    def check_expiry(self):
        stock_production_lot_obj = self.get_expiry()
        self.expired = len(stock_production_lot_obj)

    @api.multi
    def nearly_expired(self):
        stock_production_lot_obj = self.get_near_expiry()
        action = self.env.ref('stock.action_production_lot_form').read()[0]
        action['domain'] = [('id', 'in', [each_lot.id for each_lot in stock_production_lot_obj])]
        return action

    @api.multi
    def product_expired(self):
        stock_production_lot_obj = self.get_expiry()
        action = self.env.ref('stock.action_production_lot_form').read()[0]
        action['domain'] = [('id', 'in', [each_lot.id for each_lot in stock_production_lot_obj])]
        return action

    @api.model
    def category_expiry(self, company_id,from_pos_cate_id):
        data_list = []
        today_date = date.today()
        domain = [('tracking', '!=', 'none')]
        if from_pos_cate_id:
            domain += [('categ_id','=',from_pos_cate_id)]
        product_expiry_detail = self.search(domain)
        if product_expiry_detail:
            for each_product in product_expiry_detail:
                quant_detail = self.env['stock.quant'].search([('product_id', '=', each_product.id),
                                                               ('lot_id.life_date', '!=', False),
                                                               ('state_check', '=', 'near_expired'),
                                                               ('company_id.id', '=', company_id)])
                for each_quant in quant_detail:
                    life_date = datetime.strptime(each_quant.lot_id.life_date, '%Y-%m-%d %H:%M:%S').date()
                    if not life_date < today_date:
                        if from_pos_cate_id:
                            data_list.append(each_quant.read()[0])
                        else:
                            data_list.append({'name': each_quant.product_id.name, 'qty': each_quant.quantity,
                                          'catid': each_quant.product_id.categ_id.id,'categ_name': each_quant.product_id.categ_id.name})
        return data_list

    @api.model
    def search_product_expiry(self):
        company_id = self.get_current_company()
        categ_nearexpiry_data = self.category_expiry(company_id,False)
        location_obj = self.env['stock.location']
        location_detail = location_obj.get_location_detail(company_id)
        warehouse_detail = location_obj.get_warehouse_expiry_detail(company_id)
        exp_in_day = {60: 0, 30: 0, 15: 0, 10: 0, 5: 0, 1: 0}
        for exp_day in exp_in_day:
            exp_date = datetime.today() + timedelta(days=exp_day)
            self._cr.execute("select sq.product_id, sq.lot_id, sq.company_id, sq.id "
                             "from stock_quant sq left join stock_production_lot spl on spl.id = sq.lot_id "
                             "where spl.life_date >= '%s'" % datetime.today().strftime("%Y-%m-%d %H:%M:%S") + " and"
                             " spl.life_date <= '%s'" % exp_date + "and"
                             " sq.company_id = '%s'" % company_id + "group by "
                            "sq.product_id, sq.lot_id, sq.company_id, sq.id order by sq.product_id")
            result = self._cr.fetchall()
            exp_in_day[exp_day] = len(result)

        category_list = copy.deepcopy(categ_nearexpiry_data)
        category_res = []
        key = lambda x: x['categ_name']
        for k, v in groupby(sorted(category_list, key=key), key=key):
            qty = 0
            categ_id= False
            for each in v:
                qty += float(each['qty'])
                categ_id = each['catid']
            category_res.append({'categ_id':categ_id,'categ_name': k, 'qty': qty})
        expire_product = self.env['stock.production.lot'].search([('state_check', '=', 'expired')])
        exp_in_day['expired'] = len(expire_product)
        list_near_expire = []
        quant_detail = self.env['stock.quant'].search([('state_check', '=', 'near_expired'), ('company_id.id','=', company_id)])
        for each_quant in quant_detail:
            list_near_expire.append(each_quant.lot_id.id)
        exp_in_day['near_expired'] = len(set(list_near_expire))
        exp_in_day['near_expire_display'] = list_near_expire
        exp_in_day['category_near_expire'] = category_res
        exp_in_day['location_wise_expire'] = location_detail
        exp_in_day['warehouse_wise_expire'] = warehouse_detail
        return exp_in_day

    @api.model
    def get_expire_data_near_by_day(self,company_id,exp_in_day):
        exp_date = datetime.today() + timedelta(days=exp_in_day)
        self._cr.execute("select sq.product_id, sq.lot_id, sq.company_id, sq.id "
                         "from stock_quant sq left join stock_production_lot spl on spl.id = sq.lot_id "
                         "where spl.life_date >= '%s'" % datetime.today().strftime("%Y-%m-%d %H:%M:%S") + " and"
                         " spl.life_date <= '%s'" % exp_date + "and"
                         " sq.company_id = '%s'" % company_id + "group by "
                        "sq.product_id, sq.lot_id, sq.company_id,sq.id order by sq.product_id")
        result = self._cr.fetchall()
        stock_q_obj = self.env['stock.quant']
        records = []
        if result:
            for stock_q_id in result:
                stock_rec = stock_q_obj.browse(stock_q_id[3])
                records.append(stock_rec.read()[0])
        return records

    @api.model
    def graph_date_on_canvas(self, start, end):
        company_id = self.get_current_company()
        graph_data_list = []
        domain = [('state_check', '!=', False),('company_id.id', '=', company_id)]
        if start:
            domain += [('lot_id.life_date', '>=', start)]
        if end:
            domain += [('lot_id.life_date', '<=', end)]
        filter_date_record = self.env['stock.quant'].search(domain)
        for each_filter in filter_date_record.filtered(lambda l: l.quantity):
            graph_data_list.append({'product_name': each_filter.product_id.name, 'qty': each_filter.quantity})
        data_res = []
        key = lambda x: x['product_name']
        for k, v in groupby(sorted(graph_data_list, key=key), key=key):
            qty = 0
            for each in v:
                qty += float(each['qty'])
            data_res.append({'product_name': k, 'qty': qty})
        return data_res

class product_category(models.Model):
    _inherit = "pos.category"

    loyalty_point = fields.Integer("Loyalty Point")
    return_valid_days = fields.Integer("Return Valid Days")

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
