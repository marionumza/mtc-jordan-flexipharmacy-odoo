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

import copy
from odoo import fields, models, api, _
from datetime import datetime, date, timedelta
from itertools import groupby
from odoo.exceptions import ValidationError


class ProductProduct(models.Model):
    _inherit = 'product.product'

    near_expire = fields.Integer(string='Near Expire', compute='check_near_expiry')
    expired = fields.Integer(string='Expired', compute='check_expiry')

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
                    if alert_date >= today_date:
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

    @api.multi
    def category_expiry(self, company_id):
        data_list = []
        today_date = date.today()
        product_expiry_detail = self.search([('tracking', '!=', 'none')])
        if product_expiry_detail:
            for each_product in product_expiry_detail:
                quant_detail = self.env['stock.quant'].search([('product_id', '=', each_product.id),
                                                               ('lot_id.life_date', '!=', False),
                                                               ('state_check', '=', 'near_expired'),
                                                               ('company_id.id', '=', company_id)])
                for each_quant in quant_detail:
                    life_date = datetime.strptime(each_quant.lot_id.life_date, '%Y-%m-%d %H:%M:%S').date()
                    if not life_date < today_date:
                        data_list.append({'name': each_quant.product_id.name, 'qty': each_quant.quantity,
                                          'categ_name': each_quant.product_id.categ_id.name,
                                          'lot_id': each_quant.lot_id.id})

        return data_list

    @api.model
    def search_product_expiry(self):
        today = datetime.today()
        today_end_date = datetime.strftime(today, "%Y-%m-%d 23:59:59")
        today_date = datetime.strftime(today, "%Y-%m-%d 00:00:00")
        company_id = self.get_current_company()
        categ_nearexpiry_data = self.category_expiry(company_id)
        location_obj = self.env['stock.location']
        location_detail = location_obj.get_location_detail(company_id)
        warehouse_detail = location_obj.get_warehouse_expiry_detail(company_id)
        exp_in_day = {60: 0, 30: 0, 15: 0, 10: 0, 5: 0, 1: 0}
        exp_in_day_detail = {60: 0, 30: 0, 15: 0, 10: 0, 5: 0, 1: 0}
        date_add = datetime.today() + timedelta(days=1)
        today_date_exp = datetime.strftime(date_add, "%Y-%m-%d 00:00:00")
        today_date_end_exp = datetime.strftime(date_add, "%Y-%m-%d 23:59:59")
        for exp_day in exp_in_day:
            new_list = []
            exp_date = datetime.today() + timedelta(days=exp_day)
            today_exp_date = datetime.strftime(exp_date, "%Y-%m-%d 23:59:59")
            if today_date_end_exp == today_exp_date:
                self._cr.execute("select sq.lot_id "
                                 "from stock_quant sq left join stock_production_lot spl on spl.id = sq.lot_id "
                                 "where spl.life_date >= '%s'" % today_date_exp + " and"
                                 " spl.life_date <= '%s'" % today_exp_date + "and"
                                                                                                                              " sq.company_id = '%s'" % company_id + "group by sq.lot_id")
            else:
                self._cr.execute("select sq.lot_id "
                                 "from stock_quant sq left join stock_production_lot spl on spl.id = sq.lot_id "
                                 "where spl.life_date >= '%s'" % today_date + " and"
                                 " spl.life_date <= '%s'" % today_exp_date + "and"
                                 " sq.company_id = '%s'" % company_id + "group by sq.lot_id")
            result = self._cr.fetchall()
            for each in result:
                for each_in in each:
                    new_list.append(each_in)
            exp_in_day_detail[exp_day] = new_list
            exp_in_day[exp_day] = len(result)
        category_list = copy.deepcopy(categ_nearexpiry_data)
        category_res = []
        key = lambda x: x['categ_name']
        for k, v in groupby(sorted(category_list, key=key), key=key):
            qty = 0
            stock_lot = []
            for each in v:
                qty += float(each['qty'])
                stock_lot.append(each['lot_id'])
            category_res.append({'categ_name': k, 'qty': qty, 'id': stock_lot})

        expire_product = self.env['stock.production.lot'].search([('state_check', '=', 'expired')])
        exp_in_day['expired'] = len(expire_product)
        list_near_expire = []
        quant_detail = self.env['stock.quant'].search([('state_check', '=', 'near_expired'),
                                                       ('company_id.id', '=', company_id),
                                                       ('lot_id.life_date', '>=', today_date),
                                                       ('lot_id.life_date', '<=', today_end_date)])
        for each_quant in quant_detail:
            list_near_expire.append(each_quant.lot_id.id)
        exp_in_day['day_wise_expire'] = exp_in_day_detail
        exp_in_day['near_expired'] = len(set(list_near_expire))
        exp_in_day['near_expire_display'] = list_near_expire
        exp_in_day['category_near_expire'] = category_res
        exp_in_day['location_wise_expire'] = location_detail
        exp_in_day['warehouse_wise_expire'] = warehouse_detail
        return exp_in_day

    @api.multi
    def graph_date(self, start, end):
        company_id = self.get_current_company()
        graph_data_list = []
        today_date = date.today()
        start_date = datetime.strptime(start, '%Y-%m-%d').date()
        new_start_date = datetime.strftime(start_date, "%Y-%m-%d %H:%M:%S")
        end_date = datetime.strptime(end, '%Y-%m-%d').date()
        new_end_date = datetime.strftime(end_date, "%Y-%m-%d 23:59:59")
        filter_date_record = self.env['stock.quant'].search([('state_check', '!=', False),
                                                             ('product_id.tracking', '!=', 'none'),
                                                             ('company_id.id', '=', company_id),
                                                             ('lot_id.life_date', '>=', new_start_date),
                                                             ('lot_id.life_date', '<=', new_end_date)])
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


class StockProductionLot(models.Model):
    _inherit = 'stock.production.lot'

    expiry_state = fields.Selection([('expired', 'Expired'), ('near_expired', 'Near Expired')], string="Expiry State",
                                    compute="_get_product_state")
    state_check = fields.Selection([('expired', 'Expired'), ('near_expired', 'Near Expired')], string="state")

    @api.one
    @api.constrains('alert_date', 'life_date')
    def _check_dates(self):
        if self.alert_date and self.life_date:
            if not self.alert_date <= self.life_date:
                raise ValidationError(_('Dates must be: Alert Date < Expiry Date'))

    @api.model
    def name_search(self, name, args=None, operator='=', limit=100):
        if self._context.get('default_product_id'):
            stock_production_lot_obj = self.env['stock.production.lot']
            args = args or []
            recs = self.search([('product_id', operator, self._context.get('default_product_id'))])
            if recs:
                for each_stock_lot in recs.filtered(lambda l: l.life_date).sorted(key=lambda p: (p.life_date),
                                                                                  reverse=False):
                    if each_stock_lot.expiry_state != 'expired':
                        stock_production_lot_obj |= each_stock_lot
                return stock_production_lot_obj.name_get()
        return super(StockProductionLot, self).name_search(name, args, operator, limit)

    @api.one
    @api.depends('alert_date', 'life_date')
    def _get_product_state(self):
        today_date = date.today()
        for each_stock_lot in self.filtered(lambda l: l.life_date):
            if each_stock_lot.product_id.tracking != 'none':
                life_date = datetime.strptime(each_stock_lot.life_date, '%Y-%m-%d %H:%M:%S').date()
                if life_date < today_date:
                    each_stock_lot.expiry_state = 'expired'
                    each_stock_lot.write({'state_check': 'expired'})
                else:
                    if each_stock_lot.alert_date:
                        alert_date = datetime.strptime(each_stock_lot.alert_date, '%Y-%m-%d %H:%M:%S').date()
                        if alert_date >= today_date:
                            each_stock_lot.expiry_state = 'near_expired'
                            each_stock_lot.write({'state_check': 'near_expired'})
            else:
                each_stock_lot.write({'state_check': ''})

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: