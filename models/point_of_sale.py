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

from odoo import models, fields, api, tools, _
from datetime import datetime, date, time, timedelta
from dateutil.relativedelta import relativedelta
from openerp.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.addons.account.wizard.pos_box import CashBox
import time
import pytz
from pytz import timezone
from odoo.tools import float_is_zero
import logging
import psycopg2
from odoo import SUPERUSER_ID
from operator import itemgetter
from timeit import itertools

_logger = logging.getLogger(__name__)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.constrains('time_interval')
    def _check_time_interval(self):
        if self.enable_automatic_lock and self.time_interval < 0:
            raise Warning(_('Time Interval Not Valid'))

    @api.onchange('multi_shop_id')
    def on_change_multi_shop_id(self):
        if self.multi_shop_id:
            self.stock_location_id = self.multi_shop_id.location_id.id

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        user_rec = self.env['res.users'].browse(self._uid)
        erp_manager_id = self.env['ir.model.data'].get_object_reference('base',
                                                                        'group_erp_manager')[1]
        if user_rec and erp_manager_id not in user_rec.groups_id.ids:
            if user_rec.shop_ids:
                args += ['|', ('multi_shop_id', 'in', user_rec.shop_ids.ids), ('multi_shop_id', '=', False)]
            res = super(PosConfig, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        else:
            res = super(PosConfig, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        return res

    @api.model
    def get_outstanding_info(self):
        return True

    login_screen = fields.Boolean("Login Screen")
    enable_ereceipt = fields.Boolean('Send E-Receipt')
    enable_quick_cash_payment = fields.Boolean(string="Quick Cash Payment")
    validate_on_click = fields.Boolean(string="Validate On Click")
    cash_method = fields.Many2one('account.journal',"Cash Payment Method")
    payment_buttons = fields.Many2many(comodel_name='quick.cash.payment',
                                           relation='amount_button_name',
                                           column1='payment_amt_id', column2='pos_config_id')
    enable_order_note = fields.Boolean('Order Note')
    enable_product_note = fields.Boolean('Product / Line Note')
    enable_pos_return = fields.Boolean("Return Order/Products")
    enable_reorder = fields.Boolean("Reorder")
    last_days = fields.Char("Last Days")
    record_per_page = fields.Integer("Record Per Page")
    enable_draft_order = fields.Boolean("Draft Order")
    enable_rounding = fields.Boolean("Rounding Total")
    rounding_options = fields.Selection([("digits", 'Digits'), ('points','Points'),], string='Rounding Options', default='digits')
    rounding_journal_id = fields.Many2one('account.journal',"Rounding Payment Method")
    enable_bag_charges = fields.Boolean("Bag Charges")
    enable_delivery_charges = fields.Boolean("Delivery Charges")
    delivery_product_id = fields.Many2one('product.product', 'Delivery Product')
    delivery_amount = fields.Float("Delivery Amount")
    enable_manual_lock = fields.Boolean(string="Manual")
    enable_automatic_lock = fields.Boolean(string="Automatic")
    time_interval = fields.Float(string="Time Interval (Minutes)")
    enable_keyboard_shortcut = fields.Boolean("Keyboard Shortcut")
    is_scan_product = fields.Boolean(string="Is Scan Product")
    product_sync = fields.Boolean("Product Synchronization")
    display_warehouse_qty = fields.Boolean("Display Warehouse Quantity")
    pos_graph = fields.Boolean("POS Graph")
    current_session_report = fields.Boolean("Current Session Report")
    x_report = fields.Boolean("X-Report")
    enable_pos_loyalty = fields.Boolean("Loyalty")
    loyalty_journal_id = fields.Many2one("account.journal","Loyalty Journal")
    today_sale_report = fields.Boolean("Today Sale Report")
    money_in_out = fields.Boolean("Money In/Out")
    money_in_out_receipt = fields.Boolean("Money In/Out Receipt")
    enable_gift_card = fields.Boolean('Gift Card')
    gift_card_product_id = fields.Many2one('product.product',string="Gift Card Product")
    enable_journal_id = fields.Many2one('account.journal',string="Enable Journal")
    manual_card_number = fields.Boolean('Manual Card No.')
    default_exp_date = fields.Integer('Default Card Expire Months')
    msg_before_card_pay = fields.Boolean('Confirm Message Before Card Payment')
    open_pricelist_popup = fields.Char('Shortcut Key')
    enable_gift_voucher = fields.Boolean('Gift Voucher')
    gift_voucher_journal_id = fields.Many2one("account.journal", string="Gift Voucher Journal")
    enable_print_last_receipt = fields.Boolean("Print Last Receipt")
    pos_promotion = fields.Boolean("Promotion")
    show_qty = fields.Boolean(string='Display Stock')
    restrict_order = fields.Boolean(string='Restrict Order When Out Of Stock')
    prod_qty_limit = fields.Integer(string="Restrict When Product Qty Remains")
    custom_msg = fields.Char(string="Custom Message")
    enable_print_valid_days = fields.Boolean("Print Product Return Valid days")
    default_return_valid_days = fields.Integer("Default Return Valid Days")
    enable_card_charges = fields.Boolean("Card Charges")
    payment_product_id = fields.Many2one('product.product',"Payment Charge Product")
#     Wallet Functionality
    enable_wallet = fields.Boolean('Wallet')
    wallet_product = fields.Many2one('product.product', string="Wallet Product")
# Order Reservation
    enable_order_reservation = fields.Boolean('Order Reservation')
    reserve_stock_location_id = fields.Many2one('stock.location','Reserve Stock Location')
    cancellation_charges_type = fields.Selection([('fixed','Fixed'),('percentage', 'Percentage')], 'Cancellation Charges Type')
    cancellation_charges = fields.Float('Cancellation Charges')
    cancellation_charges_product_id = fields.Many2one('product.product','Cancellation Charges Product')
    prod_for_payment = fields.Many2one('product.product',string='Paid Amount Product',
                                      help="This is a dummy product used when a customer pays partially. This is a workaround to the fact that Odoo needs to have at least one product on the order to validate the transaction.")
    refund_amount_product_id = fields.Many2one('product.product','Refund Amount Product')
    enable_pos_welcome_mail = fields.Boolean("Send Welcome Mail")
    allow_reservation_with_no_amount = fields.Boolean("Allow Reservation With 0 Amount")
# Discard Product
    discard_product = fields.Boolean(string="Discard Product")
    discard_location = fields.Many2one('stock.location',string="Discard Location")
    picking_type = fields.Many2one('stock.picking.type',string="Picking Type")
# Payment_summary_report
    payment_summary = fields.Boolean(string="Payment Summary")
    current_month_date = fields.Boolean(string="Current Month Date")
# User Operation Restrict
    enable_operation_restrict = fields.Boolean("Operations Restrict")
    pos_managers_ids = fields.Many2many('res.users','posconfig_partner_rel','location_id','partner_id', string='Authorised Managers')
# Product Summary Report
    print_product_summary = fields.Boolean(string="Product Summary Report")
    no_of_copy_receipt = fields.Integer(string="No.of Copy Receipt", default=1)
    product_summary_month_date = fields.Boolean(string="Current Month Date")
    signature = fields.Boolean(string="Signature")
# Order Summary Report
    enable_order_summary = fields.Boolean(string = 'Order Summary Report')
    order_summary_no_of_copies = fields.Integer(string="No. of Copy Receipt", default=1)
    order_summary_current_month = fields.Boolean(string="Current month")
    order_summary_signature = fields.Boolean(string="Signature")
# Print Audit Report
    print_audit_report = fields.Boolean("Print Audit Report")
# POS Serial/lots
    enable_pos_serial = fields.Boolean("Enable POS serials")
    product_exp_days = fields.Integer("Product Expiry Days", default="0")
# Customer Display
    customer_display = fields.Boolean("Customer Display")
    image_interval = fields.Integer("Image Interval", default=10)
    customer_display_details_ids = fields.One2many('customer.display','config_id', "Customer Display Details")
# Expire Dashboard
    product_expiry_report = fields.Boolean(string="Product Expiry Dashboard")
# POS Dashboard
    pos_dashboard = fields.Boolean(string="Dashboard")
# Out of Stock
    out_of_stock_detail = fields.Boolean(string="Out of Stock Detail")
# POS Multi-Shop
    multi_shop_id = fields.Many2one("pos.shop", string="Shop")
    header_info = fields.Selection([('company','Company'),('store','Store')],string="Receipt Header",required=True,default="company")
# Credit Management
    prod_for_payment = fields.Many2one('product.product',string='Paid Amount Product',
                                    help="This is a dummy product used when a customer pays partially. This is a workaround to the fact that Odoo needs to have at least one product on the order to validate the transaction.")
    enable_credit = fields.Boolean('Credit Management')
    receipt_balance = fields.Boolean('Display Balance info in Receipt')
    print_ledger = fields.Boolean('Print Credit Statement')
    pos_journal_id = fields.Many2one('account.journal', string='Select Journal')
# Debit Management
    enable_debit = fields.Boolean(string="Debit Management")


class pos_order(models.Model):
    _inherit = 'pos.order'

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        user_rec = self.env['res.users'].browse(self._uid)
        erp_manager_id = self.env['ir.model.data'].get_object_reference('base',
                                                                        'group_erp_manager')[1]
        if user_rec and erp_manager_id not in user_rec.groups_id.ids:
            if user_rec.shop_ids:
                args += ['|', ('shop_id', 'in', user_rec.shop_ids.ids), ('shop_id', '=', False)]
            res = super(pos_order, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        else:
            res = super(pos_order, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        return res

    @api.model
    def load_ir_config_parameter(self):
        sys_param = self.env['ir.config_parameter'].sudo().search([('key','=','google_api_key')],order='id desc',limit=1)
        if sys_param :
            return sys_param.read()
        else:
            return False

    @api.model
    def get_dashboard_data(self):
        company_id = self.env['res.users'].browse([self._uid]).company_id.id
        res_pos_order = {'total_sales':0,'total_orders':0}
        active_sessions = self.env['pos.session'].search([('state','=','opened')]).ids
        closed_sessions = self.env['pos.session'].search([('stop_at', '>=', fields.Date.today() + " 00:00:00"),
                                                          ('stop_at', '<=', fields.Date.today() + " 23:59:59"),
                                                          ('state','in',['closing_control','closed'])]).ids
        res_pos_order['closed_sessions'] = len(closed_sessions)
        res_pos_order['active_sessions'] = len(active_sessions)
        pos_ids = self.search([('company_id', '=', company_id),
                                ('date_order', '>=', fields.Date.today() + " 00:00:00"),
                                ('date_order', '<=', fields.Date.today() + " 23:59:59"), ])
        if pos_ids:
            total_sales = 0;
            existing_partner_sale = 0
            new_partner_sale = 0
            without_partner_sale = 0
            for pos_id in pos_ids:
                total_sales += pos_id.amount_total
                if pos_id.partner_id:
                    orders = self.search([('partner_id','=',pos_id.partner_id.id),
                                        ('company_id', '=', company_id),
                                        ('date_order', '>=', fields.Date.today() + " 00:00:00"),
                                        ('date_order', '<=', fields.Date.today() + " 23:59:59"),])
                    if orders and len(orders) > 1:
                        existing_partner_sale += pos_id.amount_total
                    else:
                        new_partner_sale += pos_id.amount_total 
                else:
                    orders = self.search([('partner_id','=',False),
                                        ('company_id', '=', company_id),
                                        ('date_order', '>=', fields.Date.today() + " 00:00:00"),
                                        ('date_order', '<=', fields.Date.today() + " 23:59:59")])

                    if orders and len(orders) > 1:
                        without_partner_sale += pos_id.amount_total
            res_pos_order['client_based_sale'] = {'new_client_sale' : new_partner_sale,'existing_client_sale':existing_partner_sale,'without_client_sale':without_partner_sale} 
            res_pos_order['total_sales'] = total_sales
            res_pos_order['total_orders'] = len(pos_ids)
            current_time_zone = self.env.user.tz or 'UTC'
#             orders = []
            if self.env.user.tz:
                tz = pytz.timezone(self.env.user.tz)
            else:
                tz = pytz.utc
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            sdate = c_time.strftime("%Y-%m-%d 00:00:00")
            edate = c_time.strftime("%Y-%m-%d 23:59:59")
            if sign == '-':
                start_date = (datetime.strptime(sdate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
                end_date = (datetime.strptime(edate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
            if sign == '+':
                start_date = (datetime.strptime(sdate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
                end_date = (datetime.strptime(edate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
            self._cr.execute("""SELECT extract(hour from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s') AS date_order_hour,
                                       SUM((pol.qty * pol.price_unit) * (100 - pol.discount) / 100) AS price_total
                            FROM pos_order_line AS pol
                            LEFT JOIN pos_order po ON (po.id=pol.order_id)
                            WHERE po.date_order >= '%s'
                              AND po.date_order <= '%s'
                            GROUP BY  extract(hour from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s');
                            """ % (current_time_zone, start_date, end_date, current_time_zone))
            result_data_hour = self._cr.dictfetchall()
            hour_lst = [hrs for hrs in range(0,24)]
            for each in result_data_hour:
                if each['date_order_hour'] != 23:
                    each['date_order_hour'] = [each['date_order_hour'],each['date_order_hour'] + 1]
                else:
                    each['date_order_hour'] = [each['date_order_hour'],0]
                hour_lst.remove(int(each['date_order_hour'][0]))
            for hrs in hour_lst:
                hr = []
                if hrs != 23:
                    hr += [hrs, hrs+1]
                else:
                    hr += [hrs, 0]
                result_data_hour.append({'date_order_hour': hr, 'price_total': 0.0})
            sorted_hour_data = sorted(result_data_hour, key=lambda l: l['date_order_hour'][0])
            res_pos_order['sales_based_on_hours'] = sorted_hour_data
            # this month data
        res_curr_month = self.pos_order_month_based(1)
        res_pos_order ['current_month'] = res_curr_month
#             Last 6 month data
        last_6_month_res = self.pos_order_month_based(12)
        res_pos_order ['last_6_month_res'] = last_6_month_res
        return res_pos_order

    def pos_order_month_based(self,month_count):
        tz = pytz.utc
        c_time = datetime.now(tz)
        hour_tz = int(str(c_time)[-5:][:2])
        min_tz = int(str(c_time)[-5:][3:])
        sign = str(c_time)[-6][:1]
        current_time_zone = self.env.user.tz or 'UTC'
        stdate = c_time.strftime("%Y-%m-01 00:00:00")
        eddate = (c_time + relativedelta(day=1, months=+month_count, days=-1)).strftime("%Y-%m-%d 23:59:59")
        # this month data 
        if sign == '-':
            mon_stdate = (datetime.strptime(stdate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
            mon_eddate = (datetime.strptime(eddate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
        if sign == '+':
            mon_stdate = (datetime.strptime(stdate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
            mon_eddate = (datetime.strptime(eddate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
        if month_count == 12:
            self._cr.execute("""SELECT extract(month from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s') AS date_order_month,
                                   SUM((pol.qty * pol.price_unit) * (100 - pol.discount) / 100) AS price_total
                        FROM pos_order_line AS pol
                        LEFT JOIN pos_order po ON (po.id=pol.order_id)
                        WHERE po.date_order >= '%s'
                          AND po.date_order <= '%s'
                        GROUP BY extract(month from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s');
                        """ % (current_time_zone, mon_stdate, mon_eddate, current_time_zone))
        else:
            self._cr.execute("""SELECT extract(day from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s') AS date_order_day,
                                        extract(month from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s') AS date_order_month,
                                       SUM((pol.qty * pol.price_unit) * (100 - pol.discount) / 100) AS price_total
                            FROM pos_order_line AS pol
                            LEFT JOIN pos_order po ON (po.id=pol.order_id)
                            WHERE po.date_order >= '%s'
                              AND po.date_order <= '%s'
                            GROUP BY  extract(day from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s'),
                                extract(month from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s')
                                ORDER BY extract(day from po.date_order AT TIME ZONE 'UTC' AT TIME ZONE '%s') DESC;
                            """ % (current_time_zone,current_time_zone, mon_stdate, mon_eddate, current_time_zone,current_time_zone,current_time_zone))
        result_this_month = self._cr.dictfetchall()
        return result_this_month

    @api.model
    def graph_date_on_canvas(self,start_date,end_date):
        data = {}
        company_id = self.env['res.users'].browse([self._uid]).company_id.id
        domain = [('company_id', '=', company_id)]
        if start_date:
            domain += [('date_order', '>=', start_date)]
        else:
            domain += [('date_order', '>=', fields.Date.today() + " 00:00:00")]
        if end_date:
            domain += [('date_order', '<=', end_date)]
        else:
            domain += [('date_order', '<=', fields.Date.today() + " 23:59:59")]
        pos_ids = self.search(domain)
        if pos_ids:
            self._cr.execute("""select aj.name, aj.id, sum(amount)
                                from account_bank_statement_line as absl,
                                     account_bank_statement as abs,
                                     account_journal as aj 
                                where absl.statement_id = abs.id
                                      and abs.journal_id = aj.id 
                                     and absl.pos_statement_id IN %s
                                group by aj.name, aj.id """ % "(%s)" % ','.join(map(str, pos_ids.ids)))
            data = self._cr.dictfetchall()
        total = 0.0
        for each in data:
           total += each['sum']
        for each in data:
           each['per'] = (each['sum'] * 100) / total
        return data

    @api.model
    def session_details_on_canvas(self):
        data = {}
        domain_active_session = []
        close_session_list = []
        active_session_list = []
        company_id = self.env['res.users'].browse([self._uid]).company_id.id
        domain = [('company_id', '=', company_id),
                  ('date_order', '>=', fields.Date.today() + " 00:00:00"),
                  ('date_order', '<=', fields.Date.today() + " 23:59:59")]
        domain_active_session += domain
        domain_active_session += [('state','=','paid')]
        domain += [('state','=','done')]
        active_pos_ids = self.search(domain_active_session)
        posted_pos_ids = self.search(domain)
        if active_pos_ids:
            self._cr.execute("""select aj.name, aj.id, sum(amount),abs.pos_session_id
                                from account_bank_statement_line as absl,
                                     account_bank_statement as abs,
                                     account_journal as aj 
                                where absl.statement_id = abs.id
                                      and abs.journal_id = aj.id 
                                     and absl.pos_statement_id IN %s
                                group by aj.name, abs.pos_session_id, aj.id """ % "(%s)" % ','.join(map(str, active_pos_ids.ids)))
            active_session_data = self._cr.dictfetchall()
            session_group = {}
            sort_group = sorted(active_session_data, key=itemgetter('pos_session_id'))
            for key, value in itertools.groupby(sort_group, key=itemgetter('pos_session_id')):
                if key not in session_group:
                    session_group.update({key:[x for x in value]})
                else:
                    session_group[key] = [x for x in value]
            for k, v in session_group.items():
                total_sum = 0
                for each in v:
                    total_sum += float(each['sum'])
                active_session_list.append({'pos_session_id' : self.env['pos.session'].browse(k).read(), 'sum' : total_sum})
        if posted_pos_ids:
            self._cr.execute("""select aj.name, aj.id, sum(amount),abs.pos_session_id
                                from account_bank_statement_line as absl,
                                     account_bank_statement as abs,
                                     account_journal as aj 
                                where absl.statement_id = abs.id
                                      and abs.journal_id = aj.id 
                                     and absl.pos_statement_id IN %s
                                group by aj.name, abs.pos_session_id, aj.id """ % "(%s)" % ','.join(map(str, posted_pos_ids.ids)))
            
            posted_session_data = self._cr.dictfetchall()
            session_group = {}
            sort_group = sorted(posted_session_data, key=itemgetter('pos_session_id'))
            for key, value in itertools.groupby(sort_group, key=itemgetter('pos_session_id')):
                if key not in session_group:
                    session_group.update({key:[x for x in value]})
                else:
                    session_group[key] = [x for x in value]
            for k, v in session_group.items():
                total_sum = 0
                for each in v:
                    total_sum += float(each['sum'])
                close_session_list.append({'pos_session_id' : self.env['pos.session'].browse(k).read(), 'sum' : total_sum})
        return {'close_session': close_session_list, 'active_session': active_session_list}

    @api.model
    def graph_best_product(self,start_date,end_date):
        data = {}
        company_id = self.env['res.users'].browse([self._uid]).company_id.id
        domain = [('company_id', '=', company_id)]
        if start_date:
            domain += [('date_order', '>=', start_date)]
        else:
            domain += [('date_order', '>=', fields.Date.today() + " 00:00:00")]
        if end_date:
            domain += [('date_order', '<=', end_date)]
        else:
            domain += [('date_order', '<=', fields.Date.today() + " 23:59:59")]
        pos_ids = self.search(domain)
        if pos_ids:
            order_ids = []
            for pos_id in pos_ids:
                order_ids.append(pos_id.id)
            self._cr.execute("""
                SELECT pt.name, sum(psl.qty), SUM((psl.qty * psl.price_unit) * (100 - psl.discount) / 100) AS price_total FROM pos_order_line AS psl
                JOIN pos_order AS po ON (po.id = psl.order_id)
                JOIN product_product AS pp ON (psl.product_id = pp.id)
                JOIN product_template AS pt ON (pt.id = pp.product_tmpl_id)
                where po.id IN %s
                GROUP BY pt.name
                ORDER BY sum(psl.qty) DESC limit 50;
                """ % "(%s)" % ','.join(map(str, pos_ids.ids)))
            data = self._cr.dictfetchall()
        return data

    @api.model
    def orders_by_salesperson(self,start_date,end_date):
        data = {}
        company_id = self.env['res.users'].browse([self._uid]).company_id.id
        domain = [('company_id', '=', company_id)]
        if start_date:
            domain += [('date_order', '>=', start_date)]
        else:
            domain += [('date_order', '>=', fields.Date.today() + " 00:00:00")]
        if end_date:
            domain += [('date_order', '<=', end_date)]
        else:
            domain += [('date_order', '<=', fields.Date.today() + " 23:59:59")]
        pos_ids = self.search(domain)
        if pos_ids:
            order_ids = []
            for pos_id in pos_ids:
                order_ids.append(pos_id.id)
            self._cr.execute("""
                SELECT po.user_id, count(DISTINCT(po.id)) As total_orders, SUM((psl.qty * psl.price_unit) * (100 - psl.discount) / 100) AS price_total FROM pos_order_line AS psl
                JOIN pos_order AS po ON (po.id = psl.order_id)
                where po.id IN %s
                GROUP BY po.user_id
                ORDER BY count(DISTINCT(po.id)) DESC;
                """ % "(%s)" % ','.join(map(str, pos_ids.ids)))
            data = self._cr.dictfetchall()
        return data

    @api.one
    def get_timezone_date_order(self):
        if self.env.user.tz:
            tz = pytz.timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        c_time = datetime.now(tz)
        hour_tz = int(str(c_time)[-5:][:2])
        min_tz = int(str(c_time)[-5:][3:])
        sign = str(c_time)[-6][:1]
        if sign == '+':
            date_order = (datetime.strptime(self.date_order, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
        if sign == '-':
            date_order = (datetime.strptime(self.date_order, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime("%Y-%m-%d %H:%M:%S")
        return date_order


    @api.one
    def update_delivery_date(self, reserve_delivery_date):
        res = self.write({ 'reserve_delivery_date': datetime.strptime(reserve_delivery_date, '%Y-%m-%d') })
        if res:
            return self.read()[0]
        return False

    @api.multi
    def write(self, vals):
        res = super(pos_order, self).write(vals)
        if self._context.get('out_order'):
            return res
        for each in self:
            if vals.get('state') == 'paid' and each.reserved:
                picking_id = each.picking_id.copy()
                picking_type_id = self.env['stock.picking.type'].search([
                    ('warehouse_id', '=', each.picking_id.picking_type_id.warehouse_id.id), ('code', '=', 'outgoing')], limit=1)
                if picking_type_id:
                    location_dest_id, supplierloc = self.env['stock.warehouse']._get_partner_locations()
                    name = self.env['stock.picking.type'].browse(vals.get('picking_type_id', picking_type_id.id)).sequence_id.next_by_id()
                    picking_id.write({'picking_type_id':picking_type_id.id,'location_id':each.picking_id.location_dest_id.id,
                                      'location_dest_id': location_dest_id.id,'name':name, 'origin':each.name})
                    if picking_id.pack_operation_pack_ids:
                        picking_id.pack_operation_pack_ids.write({'location_id':each.picking_id.location_dest_id.id,
                                      'location_dest_id': location_dest_id.id})
                    if picking_id.move_lines:
                        picking_id.move_lines.write({'location_id':each.picking_id.location_dest_id.id,
                                      'location_dest_id': location_dest_id.id, 'origin':each.name})
                    picking_id.action_confirm()
                    picking_id.force_assign()
                    picking_id.button_validate()
                    stock_transfer_id = self.env['stock.immediate.transfer'].search([('pick_ids', '=', picking_id.id)], limit=1).process()
                    if stock_transfer_id:
                        stock_transfer_id.process()
                    query = ''' UPDATE pos_order SET unreserved=True,
                       picking_id='%s'
                       WHERE id=%s''' % (picking_id.id,each.id)
                    self._cr.execute(query)
                    each.write({'picking_id' :picking_id.id})
        return res

    @api.multi
    def action_pos_order_paid(self):
        if not self.test_paid():
            raise UserError(_("Order is not paid."))
        if self.is_delivery and not self.test_paid() and not self.picking_id:
            self.create_picking()
            return
        self.write({'state': 'paid'})
        #custom code
        picking_id_cust = False
        location_dest_id, supplierloc = self.env['stock.warehouse']._get_partner_locations()
        if self.order_status in ['full','partial'] or self.order_booked:
            for line in self.lines:
                if line.product_id.type != 'service' and not line.cancel_item and line.line_status == 'nothing':
                    #customer delivery order
                    picking_type_out = self.env['stock.picking.type'].search([
                    ('warehouse_id', '=', self.picking_id.picking_type_id.warehouse_id.id), ('code', '=', 'outgoing')], limit=1)
                    if picking_type_out:
                        picking_vals_rev = {
                                'name' : picking_type_out.sequence_id.next_by_id(),
                                'picking_type_id': picking_type_out.id,
                                'location_id': self.config_id.reserve_stock_location_id.id,
                                'location_dest_id': location_dest_id.id,
                                'state': 'draft',
                                'origin':self.name
                            }
                        if not picking_id_cust:
                            picking_id_cust = self.env['stock.picking'].create(picking_vals_rev)
                        self.env['stock.move'].create({
                                        'product_id': line.product_id.id,
                                        'name': line.product_id.name,
                                        'product_uom_qty': line.qty,
                                        'location_id': self.config_id.reserve_stock_location_id.id,
                                        'location_dest_id': location_dest_id.id,
                                        'product_uom': line.product_id.uom_id.id,
                                        'origin' : self.name,
                                        'picking_id' : picking_id_cust.id
                                    })
            if picking_id_cust and picking_id_cust.move_lines:
                picking_id_cust.action_confirm()
                picking_id_cust.force_assign()
                picking_id_cust.button_validate()
                stock_transfer_id = self.env['stock.immediate.transfer'].search([('pick_ids', '=', picking_id_cust.id)], limit=1)
                if stock_transfer_id:
                    stock_transfer_id.process()
                self.with_context({'out_order' :True}).write({'picking_id' : picking_id_cust.id,'unreserved':True})
            elif picking_id_cust:
                picking_id_cust.unlink()
        return self.create_picking()

    @api.model
    def create_from_ui(self, orders):
        # Credit module
        for each_data in orders:
            credit_details = each_data['data'].get('credit_detail')
            if credit_details:
                self.env['account.invoice'].get_credit_info(credit_details)
        # Keep only new orders
        submitted_references = [o['data']['name'] for o in orders]
        pos_order = self.search([('pos_reference', 'in', submitted_references)])
        existing_orders = pos_order.read(['pos_reference'])
        existing_references = set([o['pos_reference'] for o in existing_orders])
        orders_to_save = [o for o in orders if o['data']['name'] not in existing_references]
        order_ids = []

        for tmp_order in orders_to_save:
            to_invoice = tmp_order['to_invoice']
            order = tmp_order['data']
            if to_invoice:
                self._match_payment_to_invoice(order)
            pos_order = self._process_order(order)
            # create giftcard record
            if order.get('giftcard'):
                for create_details in order.get('giftcard'):
                    vals = {
                        'card_no':create_details.get('giftcard_card_no'),
                        'card_value':create_details.get('giftcard_amount'),
                        'customer_id':create_details.get('giftcard_customer') or False,
                        'expire_date':create_details.get('giftcard_expire_date'),
                        'card_type':create_details.get('card_type'),
                    }
                    self.env['aspl.gift.card'].create(vals)

            #  create redeem giftcard for use 
            if order.get('redeem') and pos_order:
                for redeem_details in order.get('redeem'):
                    redeem_vals = {
                            'pos_order_id':pos_order.id,
                            'order_date':pos_order.date_order,
                            'customer_id':redeem_details.get('card_customer_id') or False,
                            'card_id':redeem_details.get('redeem_card_no'),
                            'amount':redeem_details.get('redeem_card_amount'),
                           }
                    use_giftcard = self.env['aspl.gift.card.use'].create(redeem_vals)
                    if use_giftcard:
                        use_giftcard.card_id.write({ 'card_value': use_giftcard.card_id.card_value - use_giftcard.amount})

            #recharge giftcard
            if order.get('recharge'):
                for recharge_details in order.get('recharge'):
                    recharge_vals = {
                            'user_id':pos_order.user_id.id,
                            'recharge_date':pos_order.date_order,
                            'customer_id':recharge_details.get('card_customer_id') or False,
                            'card_id':recharge_details.get('recharge_card_id'),
                            'amount':recharge_details.get('recharge_card_amount'),
                           }
                    recharge_giftcard = self.env['aspl.gift.card.recharge'].create(recharge_vals)
                    if recharge_giftcard:
                        recharge_giftcard.card_id.write({ 'card_value': recharge_giftcard.card_id.card_value + recharge_giftcard.amount})
            if order.get('voucher'):
                for voucher in order.get('voucher'):
                    vals = {
                                'voucher_id':voucher.get('id') or False,
                                'voucher_code':voucher.get('voucher_code'),
                                'user_id':voucher.get('create_uid')[0],
                                'customer_id':order.get('partner_id'),
                                'order_name': pos_order.name,
                                'order_amount': pos_order.amount_total,
                                'voucher_amount': voucher.get('voucher_amount'),
                                'used_date': datetime.now(),
                            }
                    self.env['aspl.gift.voucher.redeem'].create(vals)
            if pos_order:
                pos_line_obj = self.env['pos.order.line']
                to_be_returned_items = {}
                to_be_cancelled_items = {}
                for line in order.get('lines'):
                    if line[2].get('cancel_process'):
                        if line[2].get('product_id') in to_be_cancelled_items:
                            to_be_cancelled_items[line[2].get('product_id')] = to_be_cancelled_items[line[2].get('product_id')] + line[2].get('qty')
                        else:
                            to_be_cancelled_items.update({line[2].get('product_id'):line[2].get('qty')})
                    if line[2].get('return_process'):
                        if line[2].get('product_id') in to_be_returned_items:
                            to_be_returned_items[line[2].get('product_id')] = to_be_returned_items[line[2].get('product_id')] + line[2].get('qty')
                        else:
                            to_be_returned_items.update({line[2].get('product_id'):line[2].get('qty')})
                for line in order.get('lines'):
                    for item_id in to_be_cancelled_items:
                        cancel_lines = []
                        if line[2].get('cancel_process'):
                            cancel_lines = self.browse([line[2].get('cancel_process')[0]]).lines
                        for origin_line in cancel_lines:
                            if to_be_cancelled_items[item_id] == 0:
                                continue
                            if origin_line.qty > 0 and item_id == origin_line.product_id.id:
                                if (to_be_cancelled_items[item_id] * -1) >= origin_line.qty:
                                    ret_from_line_qty = 0
                                    to_be_cancelled_items[item_id] = to_be_cancelled_items[item_id] + origin_line.qty
                                else:
                                    ret_from_line_qty = to_be_cancelled_items[item_id] + origin_line.qty
                                    to_be_cancelled_items[item_id] = 0
                                origin_line.write({'qty': ret_from_line_qty})
                    for item_id in to_be_returned_items:
                        if line[2].get('return_process'):
                            for origin_line in self.browse([line[2].get('return_process')[0]]).lines:
                                if to_be_returned_items[item_id] == 0:
                                    continue
                                if origin_line.return_qty > 0 and item_id == origin_line.product_id.id:
                                    if (to_be_returned_items[item_id] * -1) >= origin_line.return_qty:
                                        ret_from_line_qty = 0
                                        to_be_returned_items[item_id] = to_be_returned_items[item_id] + origin_line.return_qty
                                    else:
                                        ret_from_line_qty = to_be_returned_items[item_id] + origin_line.return_qty
                                        to_be_returned_items[item_id] = 0
                                    origin_line.write({'return_qty': ret_from_line_qty});
            order_ids.append(pos_order.id)

            try:
                pos_order.action_pos_order_paid()
            except psycopg2.OperationalError:
                # do not hide transactional errors, the order(s) won't be saved!
                raise
            except Exception as e:
                _logger.error('Could not fully process the POS Order: %s', tools.ustr(e))

            if to_invoice:
                pos_order.action_pos_order_invoice()
                pos_order.invoice_id.sudo().action_invoice_open()
                pos_order.account_move = pos_order.invoice_id.move_id
        return order_ids

    @api.model
    def _process_order(self,order):
        pos_line_obj = self.env['pos.order.line']
        res = False;
        draft_order_id = order.get('old_order_id')
        move_obj = self.env['stock.move']
        picking_obj = self.env['stock.picking']
        stock_imm_tra_obj = self.env['stock.immediate.transfer']
        picking_type_id = False
        picking_id_cust = False
        picking_id_rev = False
        if order.get('draft_order'):
            if not draft_order_id:
                order.pop('draft_order')
                order_id = self.create(self._order_fields(order))
                res = order_id
            else:
                order_id = draft_order_id
                pos_line_ids = pos_line_obj.search([('order_id', '=', order_id)])
                if pos_line_ids:
                    pos_line_obj.unlink(pos_line_ids)
                self.write([order_id],
                           {'lines': order['lines'],
                            'partner_id': order.get('partner_id')})
                res = order_id

        if not order.get('draft_order') and draft_order_id:
            order_id = draft_order_id
            order_obj = self.browse(order_id)
            pos_line_ids = pos_line_obj.search([('order_id', '=', order_id)])
            if pos_line_ids:
                for line_id in pos_line_ids:
                    line_id.unlink()
            temp = order.copy()
            temp.pop('statement_ids', None)
            temp.pop('name', None)
            temp.update({
                'date_order': order.get('creation_date')
            })
            warehouse_id = self.env['stock.warehouse'].search([
                    ('lot_stock_id', '=', order_obj.config_id.stock_location_id.id)], limit=1)
            location_dest_id, supplierloc = self.env['stock.warehouse']._get_partner_locations()
            if warehouse_id:
                picking_type_id = self.env['stock.picking.type'].search([
                    ('warehouse_id', '=', warehouse_id.id), ('code', '=', 'internal')])
            for line in order.get('lines'):
                prod_id = self.env['product.product'].browse(line[2].get('product_id'))
                prod_dict = line[2]
                if prod_id.type != 'service' and prod_dict and prod_dict.get('cancel_item'):
                    #customer delivery order
                    picking_type_out = self.env['stock.picking.type'].search([
                    ('warehouse_id', '=', order_obj.picking_id.picking_type_id.warehouse_id.id), ('code', '=', 'outgoing')], limit=1)
                    if picking_type_out:
                        picking_id_cust = picking_obj.create({
                                'name' : picking_type_out.sequence_id.next_by_id(),
                                'picking_type_id': picking_type_out.id,
                                'location_id': order_obj.config_id.reserve_stock_location_id.id,
                                'location_dest_id': location_dest_id.id,
                                'state': 'draft',
                                'origin':order_obj.name
                            })
                    if order_obj.picking_id:
                        # unreserve order
                        picking_id_rev = picking_obj.create({
                                'name' : picking_type_out.sequence_id.next_by_id(),
                                'picking_type_id': order_obj.picking_id.picking_type_id.id,
                                'location_id': order_obj.config_id.reserve_stock_location_id.id,
                                'location_dest_id': order_obj.config_id.stock_location_id.id,
                                'state': 'draft',
                                'origin':order_obj.name
                            })
                        if prod_dict.get('consider_qty') and not order_obj.order_status == 'partial' and not order.get('reserved'):
                            move_obj.create({
                                    'product_id': prod_id.id,
                                    'name': prod_id.name,
                                    'product_uom_qty': prod_dict.get('consider_qty'),
                                    'location_id': order_obj.config_id.reserve_stock_location_id.id,
                                    'location_dest_id': location_dest_id.id,
                                    'product_uom': prod_id.uom_id.id,
                                    'origin' : order_obj.name,
                                    'picking_id' : picking_id_cust.id
                                })
                        if prod_dict.get('cancel_qty'):
                            move_obj.create({
                                    'product_id': prod_id.id,
                                    'name': prod_id.name,
                                    'product_uom_qty': abs(prod_dict.get('cancel_qty')),
                                    'location_id': order_obj.config_id.reserve_stock_location_id.id,
                                    'location_dest_id': order_obj.config_id.stock_location_id.id,
                                    'product_uom': prod_id.uom_id.id,
                                    'origin' : order_obj.name,
                                    'picking_id' : picking_id_rev.id
                                })
            if picking_id_cust and picking_id_cust.move_lines:
                picking_id_cust.action_confirm()
                picking_id_cust.force_assign()
                picking_id_cust.button_validate()
                stock_transfer_id = stock_imm_tra_obj.search([('pick_ids', '=', picking_id_cust.id)], limit=1).process()
                if stock_transfer_id:
                    stock_transfer_id.process()
                order_obj.with_context({'out_order' :True}).write({'picking_id' : picking_id_cust.id,'unreserved':True})
            elif picking_id_cust:
                picking_id_cust.unlink()
            if picking_id_rev and picking_id_rev.move_lines:
                picking_id_rev.action_confirm()
                picking_id_rev.force_assign()
                picking_id_rev.button_validate()
                stock_transfer_id = stock_imm_tra_obj.search([('pick_ids', '=', picking_id_rev.id)], limit=1)
                if stock_transfer_id:
                    stock_transfer_id.process()
                order_obj.with_context({'out_order' :True}).write({'picking_id' : picking_id_rev.id,'unreserved':True})
            elif picking_id_rev:
                picking_id_rev.unlink()
            order_obj.write(temp)
            for payments in order['statement_ids']:
                order_obj.with_context({'from_pos':True}).add_payment(self._payment_fields(payments[2]))

            session = self.env['pos.session'].browse(order['pos_session_id'])
            if session.sequence_number <= order['sequence_number']:
                session.write({'sequence_number': order['sequence_number'] + 1})
                session.refresh()

            if not float_is_zero(order['amount_return'], self.env['decimal.precision'].precision_get('Account')):
                cash_journal = session.cash_journal_id
                if not cash_journal:
                    cash_journal_ids = session.statement_ids.filtered(lambda st: st.journal_id.type == 'cash')
                    if not len(cash_journal_ids):
                        raise Warning(_('error!'),
                                             _("No cash statement found for this session. Unable to record returned cash."))
                    cash_journal = cash_journal_ids[0].journal_id
                order_obj.with_context({'from_pos':True}).add_payment({
                    'amount': -order['amount_return'],
                    'payment_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'payment_name': _('return'),
                    'journal': cash_journal.id,
                })
            res =  order_obj

        if not order.get('draft_order') and not draft_order_id:
            res = super(pos_order, self)._process_order(order)
            if res:
                if order.get('wallet_type'):
                    if order.get('change_amount_for_wallet'):
                        session_id = res.session_id
                        cash_register_id = session_id.cash_register_id
                        if not cash_register_id:
                            raise Warning(_('There is no cash register for this PoS Session'))
                        cash_bocx_in_obj = self.env['cash.box.in'].create({'name': 'Credit', 'amount': order.get('change_amount_for_wallet')})
                        cash_bocx_in_obj._run(cash_register_id)
                        vals = {
                                'customer_id': res.partner_id.id,
                                'type': order.get('wallet_type'),
                                'order_id': res.id,
                                'credit': order.get('change_amount_for_wallet'),
                                'cashier_id': order.get('user_id'),
                                }
                        self.env['wallet.management'].create(vals)
                    if order.get('used_amount_from_wallet'):
                        vals = {
                                'customer_id': res.partner_id.id,
                                'type': order.get('wallet_type'),
                                'order_id': res.id,
                                'debit': order.get('used_amount_from_wallet'),
                                'cashier_id': order.get('user_id'),
                                }
                        self.env['wallet.management'].create(vals)
        if res.session_id.config_id.enable_pos_loyalty and res.partner_id:
            loyalty_setting_id = self.env['loyalty.config.settings'].sudo().search([],order="id desc", limit=1)
            if loyalty_setting_id:
                if loyalty_setting_id.points_based_on and order.get('loyalty_earned_point'):
                    point_vals = {
                        'pos_order_id': res.id,
                        'partner_id': res.partner_id.id,
                        'points': order.get('loyalty_earned_point'),
                        'amount_total': (float(order.get('loyalty_earned_point')) * loyalty_setting_id.to_amount) / loyalty_setting_id.points
                    }
                    loyalty = self.env['loyalty.point'].create(point_vals)
                    if loyalty and res.partner_id.send_loyalty_mail:
                        try:
                            template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy', 'email_template_pos_loyalty')
                            template_obj = self.env['mail.template'].browse(template_id[1])
                            template_obj.send_mail(loyalty.id,force_send=True, raise_exception=True)
                        except Exception as e:
                            _logger.error('Unable to send email for order %s',e)
                if order.get('loyalty_redeemed_point'):
                    redeemed_vals = {
                        'redeemed_pos_order_id': res.id,
                        'partner_id': res.partner_id.id,
                        'redeemed_amount_total': self._calculate_amount_total_by_points(loyalty_setting_id, order.get('loyalty_redeemed_point')),
                        'redeemed_point': order.get('loyalty_redeemed_point'),
                    }
                    self.env['loyalty.point.redeem'].create(redeemed_vals)
        if order.get('customer_email') and res and res.reserved:
            try:
                template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy', 'email_template_pos_ereceipt_reservation')
                template_obj = self.env['mail.template'].browse(template_id[1])
                template_obj.send_mail(res.id,force_send=True, raise_exception=True)
            except Exception as e:
                _logger.error('Unable to send email for order %s', e)
        if order.get('customer_email') and res and not res.reserved:
            try:
                template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy', 'email_template_pos_ereceipt')
                template_obj = self.env['mail.template'].browse(template_id[1])
                template_obj.send_mail(res.id,force_send=True, raise_exception=True)
            except Exception as e:
                _logger.error('Unable to send email for order %s',e)
        return res


    def _order_fields(self,ui_order):
        res = super(pos_order, self)._order_fields(ui_order)
        res.update({
            'is_debit': ui_order.get('is_debit') or False,
            'is_delivery': ui_order.get('is_delivery') or False,
            'customer_email': ui_order.get('customer_email'),
            'note': ui_order.get('order_note') or False,
            'return_order':         ui_order.get('return_order', ''),
            'back_order':           ui_order.get('back_order', ''),
            'parent_return_order':  ui_order.get('parent_return_order', ''),
            'return_seq':           ui_order.get('return_seq', ''),
            'is_rounding':          ui_order.get('is_rounding') or False,
            'rounding_option':      ui_order.get('rounding_option') or False,
            'rounding':             ui_order.get('rounding') or False,
            'delivery_date':        ui_order.get('delivery_date') or False,
            'delivery_time':        ui_order.get('delivery_time') or False,
            'delivery_address':     ui_order.get('delivery_address') or False,
            'delivery_charge_amt':     ui_order.get('delivery_charge_amt') or False,
            'total_loyalty_earned_points': ui_order.get('loyalty_earned_point') or 0.00,
            'total_loyalty_earned_amount': ui_order.get('loyalty_earned_amount') or 0.00,
            'total_loyalty_redeem_points': ui_order.get('loyalty_redeemed_point') or 0.00,
            'total_loyalty_redeem_amount': ui_order.get('loyalty_redeemed_amount') or 0.00,
            'order_booked' : ui_order.get('reserved') or False,
            'reserved': ui_order.get('reserved') or False,
            'reserve_delivery_date': ui_order.get('reserve_delivery_date') or False,
            'cancel_order': ui_order.get('cancel_order_ref') or False,
            'fresh_order': ui_order.get('fresh_order') or False,
            'partial_pay': ui_order.get('partial_pay') or False,
            'shop_id': ui_order.get('shop_id') or False,

        })
        return res

    def set_pack_operation_lot(self, picking=None):
        """Set Serial/Lot number in pack operations to mark the pack operation done."""

        StockProductionLot = self.env['stock.production.lot']
        PosPackOperationLot = self.env['pos.pack.operation.lot']
        has_wrong_lots = False
        for order in self:
            for move in (picking or self.picking_id).move_lines:
                picking_type = (picking or self.picking_id).picking_type_id
                lots_necessary = True
                if picking_type:
                    lots_necessary = picking_type and picking_type.use_existing_lots
                qty = 0
                qty_done = 0
                pack_lots = []
                pos_pack_lots = PosPackOperationLot.search(
                    [('order_id', '=', order.id), ('product_id', '=', move.product_id.id)])
                pack_lot_names = [pos_pack.lot_name for pos_pack in pos_pack_lots]

                if pack_lot_names and lots_necessary:
                    for lot_name in list(set(pack_lot_names)):
                        stock_production_lot = StockProductionLot.search(
                            [('name', '=', lot_name), ('product_id', '=', move.product_id.id)])
                        if stock_production_lot:
                            if stock_production_lot.product_id.tracking == 'lot':
                                qty = pack_lot_names.count(lot_name)
                            #                                 qty = move.product_uom_qty
                            else:  # serial numbers
                                qty = 1.0
                            qty_done += qty
                            pack_lots.append({'lot_id': stock_production_lot.id, 'qty': qty})
                        else:
                            has_wrong_lots = True
                elif move.product_id.tracking == 'none' or not lots_necessary:
                    qty_done = move.product_uom_qty
                else:
                    has_wrong_lots = True
                for pack_lot in pack_lots:
                    lot_id, qty = pack_lot['lot_id'], pack_lot['qty']
                    self.env['stock.move.line'].create({
                        'move_id': move.id,
                        'product_id': move.product_id.id,
                        'product_uom_id': move.product_uom.id,
                        'qty_done': qty,
                        'location_id': move.location_id.id,
                        'location_dest_id': move.location_dest_id.id,
                        'lot_id': lot_id,
                    })
                if not pack_lots and not float_is_zero(qty_done, precision_rounding=move.product_uom.rounding):
                    move.quantity_done = qty_done
        return has_wrong_lots

    @api.model
    def add_payment(self, data):
        """Create a new payment for the order"""
        if data['amount'] == 0.0:
            return
        return super(pos_order, self).add_payment(data)

    @api.one
    def send_reserve_mail(self):
        if self and self.customer_email and self.reserved and self.fresh_order:
            try:
                template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy', 'email_template_pos_ereceipt')
                template_obj = self.env['mail.template'].browse(template_id[1])
                template_obj.send_mail(self.id,force_send=True, raise_exception=True)
            except Exception as e:
                _logger.error('Unable to send email for order %s', e)

    def create(self, values):
        order_id = super(pos_order, self).create(values)
        rounding_journal_id = order_id.session_id.config_id.rounding_journal_id
        if order_id.rounding != 0:
            if rounding_journal_id:
                order_id.add_payment({
                    'amount':order_id.rounding * -1,
                    'payment_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'payment_name': _('Rounding'),
                    'journal': rounding_journal_id.id,
                })
#         if values.get('customer_email') and order_id:
#             try:
#                 template_id = self.env['ir.model.data'].get_object_reference('flexipharmacy', 'email_template_pos_ereceipt')
#                 template_obj = self.env['mail.template'].browse(template_id[1])
#                 template_obj.send_mail(order_id.id,force_send=True, raise_exception=True)
#             except Exception as e:
#                 _logger.error('Unable to send email for order %s',e)
        return order_id

    def _calculate_amount_total_by_points(self, loyalty_config, points):
        return (float(points) * loyalty_config.to_amount) / loyalty_config.points

    def get_point_from_category(self, categ_id):
        if categ_id.loyalty_point:
            return categ_id.loyalty_point
        elif categ_id.parent_id:
            self.get_point_from_category(categ_id.parent_id)
        return False

    def _calculate_loyalty_points_by_order(self, loyalty_config):
        if loyalty_config.point_calculation:
            earned_points = self.amount_total * loyalty_config.point_calculation / 100
            amount_total = (earned_points * loyalty_config.to_amount) / loyalty_config.points
            return {
                'points': earned_points,
                'amount_total': amount_total
            }
        return False

    @api.multi
    def refund(self):
        res = super(pos_order, self).refund()
        LoyaltyPoints = self.env['loyalty.point']
        refund_order_id = self.browse(res.get('res_id'))
        if refund_order_id:
            LoyaltyPoints.create({
                'pos_order_id': refund_order_id.id,
                'partner_id': self.partner_id.id,
                'points': refund_order_id.total_loyalty_redeem_points,
                'amount_total': refund_order_id.total_loyalty_redeem_amount,

            })
            LoyaltyPoints.create({
                'pos_order_id': refund_order_id.id,
                'partner_id': self.partner_id.id,
                'points': refund_order_id.total_loyalty_earned_points * -1,
                'amount_total': refund_order_id.total_loyalty_earned_amount * -1,
                
            })
            refund_order_id.write({
                'total_loyalty_earned_points': refund_order_id.total_loyalty_earned_points * -1,
                'total_loyalty_earned_amount': refund_order_id.total_loyalty_earned_amount * -1,
                'total_loyalty_redeem_points': 0.00,
                'total_loyalty_redeem_amount': 0.00,
            })
        return res

# POS Reorder start here
    @api.model
    def ac_pos_search_read(self, domain):
        domain = domain.get('domain')
        search_vals = self.search_read(domain)
        user_id = self.env['res.users'].browse(self._uid)
        tz = False
        result = []
        if self._context and self._context.get('tz'):
            tz = timezone(self._context.get('tz'))
        elif user_id and user_id.tz:
            tz = timezone(user_id.tz)
        if tz:
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            for val in search_vals:
                if sign == '-':
                    val.update({
                        'date_order':(datetime.strptime(val.get('date_order'), '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz, minutes=min_tz)).strftime('%Y-%m-%d %H:%M:%S')
                    })
                elif sign == '+':
                    val.update({
                        'date_order':(datetime.strptime(val.get('date_order'), '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz, minutes=min_tz)).strftime('%Y-%m-%d %H:%M:%S')
                    })
                result.append(val)
            return result
        else:
            return search_vals
# POS Reorder end here

    @api.one
    def multi_picking(self):
        Picking = self.env['stock.picking']
        Move = self.env['stock.move']
        StockWarehouse = self.env['stock.warehouse']
        address = self.partner_id.address_get(['delivery']) or {}
        picking_type = self.picking_type_id
        order_picking = Picking
        return_picking = Picking
        return_pick_type = self.picking_type_id.return_picking_type_id or self.picking_type_id
        message = _("This transfer has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (self.id, self.name)
        if self.partner_id:
            destination_id = self.partner_id.property_stock_customer.id
        else:
            if (not picking_type) or (
                    not picking_type.default_location_dest_id):
                customerloc, supplierloc = StockWarehouse._get_partner_locations()
                destination_id = customerloc.id
            else:
                destination_id = picking_type.default_location_dest_id.id
        lst_picking = []
        location_ids = list(set([line.location_id.id for line in self.lines]))
        for loc_id in location_ids:
            picking_vals = {
                'origin': self.name,
                'partner_id': address.get('delivery', False),
                'date_done': self.date_order,
                'picking_type_id': picking_type.id,
                'company_id': self.company_id.id,
                'move_type': 'direct',
                'note': self.note or "",
                'location_id': loc_id,
                'location_dest_id': destination_id,
            }
            pos_qty = any(
                [x.qty > 0 for x in self.lines if x.product_id.type in ['product', 'consu']])
            if pos_qty:
                order_picking = Picking.create(picking_vals.copy())
                order_picking.message_post(body=message)
            neg_qty = any(
                [x.qty < 0 for x in self.lines if x.product_id.type in ['product', 'consu']])
            if neg_qty:
                return_vals = picking_vals.copy()
                return_vals.update({
                    'location_id': destination_id,
                    'location_dest_id': loc_id,
                    'picking_type_id': return_pick_type.id
                })
                return_picking = Picking.create(return_vals)
                return_picking.message_post(body=message)
            for line in self.lines.filtered(
                lambda l: l.product_id.type in [
                    'product',
                    'consu'] and l.location_id.id == loc_id and not float_is_zero(
                    l.qty,
                    precision_digits=l.product_id.uom_id.rounding)):
                Move.create({
                    'name': line.name,
                    'product_uom': line.product_id.uom_id.id,
                    'picking_id': order_picking.id if line.qty >= 0 else return_picking.id,
                    'picking_type_id': picking_type.id if line.qty >= 0 else return_pick_type.id,
                    'product_id': line.product_id.id,
                    'product_uom_qty': abs(line.qty),
                    'state': 'draft',
                    'location_id': loc_id if line.qty >= 0 else destination_id,
                    'location_dest_id': destination_id if line.qty >= 0 else loc_id,
                })
            if return_picking:
                self.write({'picking_ids': [(4, return_picking.id)]})
                self._force_picking_done(return_picking)
            if order_picking:
                self.write({'picking_ids': [(4, order_picking.id)]})
                self._force_picking_done(order_picking)
        return True

    def create_picking(self):
        """Create a picking for each order and validate it."""
        if self.order_status not in ['full','partial'] and not self.order_booked:
            super(pos_order, self).create_picking()
        return True
        Picking = self.env['stock.picking']
        Move = self.env['stock.move']
        StockWarehouse = self.env['stock.warehouse']
        for order in self:
            # custom multi location
            multi_loc = False
            for line_order in order.lines:
                if line_order.location_id:
                    multi_loc = True
                    break
            if multi_loc:
                order.multi_picking()
            else:
                if not order.lines.filtered(
                    lambda l: l.product_id.type in [
                        'product', 'consu']):
                    continue
                address = order.partner_id.address_get(['delivery']) or {}
                picking_type = order.picking_type_id
                return_pick_type = order.picking_type_id.return_picking_type_id or order.picking_type_id
                order_picking = Picking
                return_picking = Picking
                moves = Move
                location_id = order.location_id.id
                if order.partner_id:
                    destination_id = order.partner_id.property_stock_customer.id
                else:
                    if (not picking_type) or (
                            not picking_type.default_location_dest_id):
                        customerloc, supplierloc = StockWarehouse._get_partner_locations()
                        destination_id = customerloc.id
                    else:
                        destination_id = picking_type.default_location_dest_id.id

                if picking_type:
                    message = _(
                        "This transfer has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (order.id, order.name)
                    picking_vals = {
                        'origin': order.name,
                        'partner_id': address.get('delivery', False),
                        'date_done': order.date_order,
                        'picking_type_id': picking_type.id,
                        'company_id': order.company_id.id,
                        'move_type': 'direct',
                        'note': order.note or "",
                        'location_id': location_id,
                        'location_dest_id': destination_id,
                    }
                    pos_qty = any(
                        [x.qty > 0 for x in order.lines if x.product_id.type in ['product', 'consu']])
                    if pos_qty:
                        order_picking = Picking.create(picking_vals.copy())
                        order_picking.message_post(body=message)
                    neg_qty = any(
                        [x.qty < 0 for x in order.lines if x.product_id.type in ['product', 'consu']])
                    if neg_qty:
                        return_vals = picking_vals.copy()
                        return_vals.update({
                            'location_id': destination_id,
                            'location_dest_id': return_pick_type != picking_type and return_pick_type.default_location_dest_id.id or location_id,
                            'picking_type_id': return_pick_type.id
                        })
                        return_picking = Picking.create(return_vals)
                        return_picking.message_post(body=message)

                    for line in order.lines.filtered(
                        lambda l: l.product_id.type in [
                            'product', 'consu'] and not float_is_zero(
                            l.qty, precision_digits=l.product_id.uom_id.rounding)):
                        moves |= Move.create({
                            'name': line.name,
                            'product_uom': line.product_id.uom_id.id,
                            'picking_id': order_picking.id if line.qty >= 0 else return_picking.id,
                            'picking_type_id': picking_type.id if line.qty >= 0 else return_pick_type.id,
                            'product_id': line.product_id.id,
                            'product_uom_qty': abs(line.qty),
                            'state': 'draft',
                            'location_id': location_id if line.qty >= 0 else destination_id,
                            'location_dest_id': destination_id if line.qty >= 0 else return_pick_type != picking_type and return_pick_type.default_location_dest_id.id or location_id,
                        })

                    # prefer associating the regular order picking, not the
                    # return
                    order.write(
                        {'picking_id': order_picking.id or return_picking.id})

                    if return_picking:
                        order._force_picking_done(return_picking)
                    if order_picking:
                        order._force_picking_done(order_picking)

                # when the pos.config has no picking_type_id set only the moves
                # will be created
                if moves and not return_picking and not order_picking:
                    tracked_moves = moves.filtered(
                        lambda move: move.product_id.tracking != 'none')
                    untracked_moves = moves - tracked_moves
                    tracked_moves.action_confirm()
                    untracked_moves.action_assign()
                    moves.filtered(
                        lambda m: m.state in [
                            'confirmed',
                            'waiting']).force_assign()
                    moves.filtered(
                        lambda m: m.product_id.tracking == 'none').action_done()
        return True

    @api.multi
    def do_internal_transfer(self):
        for order in self:
            if order.config_id.reserve_stock_location_id and order.config_id.stock_location_id:
                # Move Lines
                temp_move_lines = []
                for line in order.lines:
                    if line.product_id.default_code:
                        name = [line.product_id.default_code]
                    else:
                        name = line.product_id.name
                    if line.product_id.type != "service":
                        move_vals = (0,0,{
                            'product_id': line.product_id.id,
                            'name': name,
                            'product_uom_qty': line.qty,
                            'location_id': order.config_id.stock_location_id.id,
                            'location_dest_id': order.config_id.reserve_stock_location_id.id,
                            'product_uom': line.product_id.uom_id.id,
                        })
                        temp_move_lines.append(move_vals)
                warehouse_obj = self.env['stock.warehouse'].search([
                    ('lot_stock_id', '=', order.config_id.stock_location_id.id)], limit=1)
                if warehouse_obj:
                    picking_type_obj = self.env['stock.picking.type'].search([
                        ('warehouse_id', '=', warehouse_obj.id), ('code', '=', 'internal')])
                    if picking_type_obj and temp_move_lines:
                        
                        picking_vals = {
                            'picking_type_id': picking_type_obj.id,
                            'location_id': order.config_id.stock_location_id.id,
                            'location_dest_id': order.config_id.reserve_stock_location_id.id,
                            'state': 'draft',
                            'move_lines': temp_move_lines,
                            'origin':order.name
                        }
                        picking_obj = self.env['stock.picking'].create(picking_vals)
                        if picking_obj:
                            picking_obj.action_confirm()
                            picking_obj.force_assign()
                            picking_obj.button_validate()
                            stock_transfer_id = self.env['stock.immediate.transfer'].search([('pick_ids', '=', picking_obj.id)], limit=1)
                            if stock_transfer_id:
                                stock_transfer_id.process()
                            order.picking_id = picking_obj.id

    @api.multi
    @api.depends('amount_total', 'amount_paid')
    def _compute_amount_due(self):
        for each in self:
            each.amount_due = each.amount_total - each.amount_paid

    @api.multi
    @api.depends('lines')
    def _find_order_status(self):
        for order in self:
            partial, full = [], []
            line_count = 0;
            line_partial = False
            for line in order.lines:
                if not line.cancel_item:
                    line_count += 1
                    if line.line_status == "partial":
                        order.order_status = "partial"
                        line_partial = True
                        break
                    if line.line_status == "full":
                        full.append(True)
            if len(full) == line_count:
                if not False in full and not line_partial:
                    order.order_status = "full"
            elif full:
                order.order_status = "partial"

    @api.model
    def graph_data(self, from_date, to_date, category, limit, session_id, current_session_report):
        if from_date and not to_date:
            if from_date.split(' ')[0] and len(from_date.split(' ')) > 1:
                to_date = from_date.split(' ')[0]+" 23:59:59"
        elif to_date and not from_date:
            if to_date.split(' ')[0] and len(to_date.split(' ')) > 1:
                from_date = to_date.split(' ')[0]+" 00:00:00"
        try:
            if from_date and to_date:
                if category == 'top_customer':
                    if current_session_report:
                        order_ids = self.env['pos.order'].search([('partner_id', '!=', False),
                                                                ('date_order', '>=', from_date),
                                                                ('date_order', '<=', to_date),
                                                                ('session_id','=',session_id)], order='date_order desc')
                    else:
                        order_ids = self.env['pos.order'].search([('partner_id', '!=', False),
                                                                ('date_order', '>=', from_date),
                                                                ('date_order', '<=', to_date)], order='date_order desc')
                    result = []
                    record = {}
                    if order_ids:
                        for each_order in order_ids:
                            if each_order.partner_id in record:
                                record.update({each_order.partner_id: record.get(each_order.partner_id) + each_order.amount_total})
                            else:
                                record.update({each_order.partner_id: each_order.amount_total})
                    if record:
                        result = [(k.name, v) for k, v in record.items()]
                        result = sorted(result, key=lambda x: x[1], reverse=True)
                    if limit == 'ALL':
                        return result
                    return result[:int(limit)]
                if category == 'top_products':
                    if current_session_report:
                        self._cr.execute("""
                            SELECT pt.name, pp.id, sum(psl.qty) FROM pos_order_line AS psl
                            JOIN pos_order AS po ON (po.id = psl.order_id)
                            JOIN product_product AS pp ON (psl.product_id = pp.id)
                            JOIN product_template AS pt ON (pt.id = pp.product_tmpl_id)
                            WHERE po.date_order >= '%s'
                            AND po.date_order <= '%s'
                            AND po.session_id = '%s'
                            GROUP BY pt.name, pp.id
                            ORDER BY sum(psl.qty) DESC limit %s;
                            """%((from_date, to_date, session_id, limit)))
                        return self._cr.fetchall()
                    else:
                        self._cr.execute("""
                            SELECT pt.name, pp.id, sum(psl.qty) FROM pos_order_line AS psl
                            JOIN pos_order AS po ON (po.id = psl.order_id)
                            JOIN product_product AS pp ON (psl.product_id = pp.id)
                            JOIN product_template AS pt ON (pt.id = pp.product_tmpl_id)
                            WHERE po.date_order >= '%s'
                            AND po.date_order <= '%s'
                            GROUP BY pt.name, pp.id
                            ORDER BY sum(psl.qty) DESC limit %s;
                            """%((from_date, to_date, limit)))
                        return self._cr.fetchall()
                if category == 'cashiers':
                    if current_session_report:
                        self._cr.execute("""
                            SELECT pc.name, SUM(absl.amount) FROM account_bank_statement_line absl
                            JOIN account_journal aj ON absl.journal_id = aj.id
                            JOIN pos_session as ps ON ps.name = absl.ref
                            JOIN pos_config as pc ON pc.id = ps.config_id
                            WHERE absl.create_date >= '%s' AND absl.create_date <= '%s'
                            AND ps.id = '%s'
                            GROUP BY pc.name
                            limit %s
                            """%((from_date, to_date, session_id, limit)))
                        return self._cr.fetchall()
                    else:
                        SQL1 = """SELECT pc.name,sum(abs.balance_end) from 
                                pos_session ps,account_bank_statement abs,pos_config pc
                                WHERE abs.pos_session_id = ps.id 
                                AND pc.id = ps.config_id
                                AND ps.start_at AT TIME ZONE 'GMT' >= '%s' 
                                and ps.start_at  AT TIME ZONE 'GMT' <= '%s'
                                GROUP BY pc.name;
                                """ % ((from_date, to_date))
                        self._cr.execute(SQL1)
                        find_session = self._cr.fetchall()
                        return find_session
                if category == 'sales_by_location':
                    if current_session_report:
                        self._cr.execute("""
                            SELECT (loc1.name || '/' || loc.name) as name, sum(psl.price_unit) FROM pos_order_line AS psl
                            JOIN pos_order AS po ON (po.id = psl.order_id)
                            JOIN stock_location AS loc ON (loc.id = po.location_id)
                            JOIN stock_location AS loc1 ON (loc.location_id = loc1.id)
                            WHERE po.date_order >= '%s'
                            AND po.date_order <= '%s'
                            AND po.session_id = '%s'
                            GROUP BY loc.name, loc1.name
                            limit %s
                            """%((from_date,to_date, session_id, limit)))
                        return self._cr.fetchall()
                    else:
                        self._cr.execute("""
                            SELECT (loc1.name || '/' || loc.name) as name, sum(psl.price_unit) FROM pos_order_line AS psl
                            JOIN pos_order AS po ON (po.id = psl.order_id)
                            JOIN stock_location AS loc ON (loc.id = po.location_id)
                            JOIN stock_location AS loc1 ON (loc.location_id = loc1.id)
                            WHERE po.date_order >= '%s'
                            AND po.date_order <= '%s'
                            GROUP BY loc.name, loc1.name
                            limit %s
                            """%((from_date,to_date, limit)))
                        return self._cr.fetchall()
                if category == 'income_by_journals':
                    if current_session_report:
                        self._cr.execute("""
                            select aj.name, sum(absl.amount) from account_bank_statement_line absl
                            join account_journal aj on absl.journal_id = aj.id
                            join pos_session as ps on ps.name = absl.ref
                            join pos_config as pc on pc.id = ps.config_id
                            where absl.create_date >= '%s' and absl.create_date <= '%s'
                            and ps.id = '%s'
                            group by aj.name
                            limit %s
                            """%((from_date,to_date, session_id, limit)))
                        return self._cr.fetchall()
                    else:
                        self._cr.execute("""
                        select aj.name, sum(absl.amount) from account_bank_statement_line absl
                        join account_journal aj on absl.journal_id = aj.id
                        join pos_session as ps on ps.name = absl.ref
                        join pos_config as pc on pc.id = ps.config_id
                        where absl.create_date >= '%s' and absl.create_date <= '%s'
                        group by aj.name
                        limit %s
                        """%((from_date,to_date, limit)))
                    return self._cr.fetchall()
                if category == 'top_category':
                    if current_session_report:
                        self._cr.execute("""
                            SELECT pc.name, sum((pol.price_unit * pol.qty) - pol.discount) 
                            FROM pos_category pc
                            join product_template pt on pc.id = pt.pos_categ_id
                            join product_product pp on pt.id = pp.product_tmpl_id
                            join pos_order_line pol on pp.id = pol.product_id
                            join pos_order po on pol.order_id = po.id
                            where pol.create_date >= '%s' and pol.create_date <= '%s'
                            and po.session_id = '%s'
                            group by pc.name
                            ORDER BY sum(pol.price_unit) DESC
                            limit %s
                            """%((from_date,to_date, session_id, limit)))
                        return self._cr.fetchall()
                    else:
                        self._cr.execute("""
                            SELECT pc.name, sum((pol.price_unit * pol.qty) - pol.discount) 
                            FROM pos_category pc
                            join product_template pt on pc.id = pt.pos_categ_id
                            join product_product pp on pt.id = pp.product_tmpl_id
                            join pos_order_line pol on pp.id = pol.product_id
                            join pos_order po on pol.order_id = po.id
                            where pol.create_date >= '%s' and pol.create_date <= '%s'
                            group by pc.name
                            ORDER BY sum(pol.price_unit) DESC
                            limit %s
                            """%((from_date,to_date, limit)))
                        return self._cr.fetchall()
                if category == 'pos_benifit':
                    domain = False
                    if current_session_report:
                        domain = [('date_order', '>=', from_date),
                                      ('date_order', '<=', to_date),
                                      ('session_id','=',session_id)]
                    else:
                        domain = [('date_order', '>=', from_date),
                                      ('date_order', '<=', to_date)]
                    if domain and len(domain) > 1:
                        order_ids = self.env['pos.order'].search(domain, order='date_order desc')
                        if len(order_ids) > 0:
                            profit_amount = 0
                            loss_amount = 0
                            loss = 0
                            profit = 0
                            for order in order_ids:
                                for line in order.lines:
                                    cost_price = line.product_id.standard_price * line.qty
                                    sale_price = line.price_subtotal_incl
                                    profit_amount += (sale_price - cost_price)
                                    loss_amount += (cost_price - sale_price)
                            if loss_amount > 0:
                                loss = loss_amount
                            if profit_amount > 0:
                                profit = profit_amount
                            return [('Profit', profit), ('Loss', loss)]
                    return False
        except Exception as e:
           return {'error':e}

    @api.model
    def payment_summary_report(self,vals):
        if(vals):
            journals_detail = {}
            salesmen_detail = {}
            summary_data = {}
            order_detail = self.env['pos.order'].search([('date_order', '>=', vals.get('start_date')),
                                                         ('date_order', '<=', vals.get('end_date'))
                                                         ])
            if 'journals' in vals.get('summary'):
                if (order_detail):
                    for each_order in order_detail:
                       order_date = each_order.date_order
                       date1 = datetime.strptime(order_date, '%Y-%m-%d  %H:%M:%S')
                       month_year = date1.strftime("%B-%Y")
                       if not month_year in journals_detail:
                           journals_detail[month_year] = {}
                           for payment_line in each_order.statement_ids:
                               if payment_line.statement_id.journal_id.name in journals_detail[month_year]:
                                   payment = journals_detail[month_year][payment_line.statement_id.journal_id.name]
                                   payment += payment_line.amount
                               else:
                                   payment = payment_line.amount
                               journals_detail[month_year][payment_line.statement_id.journal_id.name] = float(
                               format(payment, '2f'));
                       else:
                           for payment_line in each_order.statement_ids:
                               if payment_line.statement_id.journal_id.name in journals_detail[month_year]:
                                   payment = journals_detail[month_year][payment_line.statement_id.journal_id.name]
                                   payment += payment_line.amount
                               else:
                                   payment = payment_line.amount
                               journals_detail[month_year][payment_line.statement_id.journal_id.name] = float(
                                   format(payment, '2f'));
                    for journal in journals_detail.values():
                        for i in journal:
                            if i in summary_data:
                                total = journal[i] + summary_data[i]
                            else:
                                total = journal[i]
                            summary_data[i] = float(format(total, '2f'));

            if 'sales_person' in vals.get('summary'):
                if (order_detail):
                    for each_order in order_detail:
                       order_date = each_order.date_order
                       date1 = datetime.strptime(order_date, '%Y-%m-%d  %H:%M:%S')
                       month_year = date1.strftime("%B-%Y")
                       if each_order.user_id.name not in salesmen_detail:
                           salesmen_detail[each_order.user_id.name] = {}
                           if not month_year in salesmen_detail[each_order.user_id.name]:
                               salesmen_detail[each_order.user_id.name][month_year] = {}
                               for payment_line in each_order.statement_ids:
                                   if payment_line.statement_id.journal_id.name in salesmen_detail[each_order.user_id.name][month_year]:
                                       payment = salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name]
                                       payment += payment_line.amount
                                   else:
                                       payment = payment_line.amount
                                   salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name] = float(
                                   format(payment, '2f'));
                       else:
                           if not month_year in salesmen_detail[each_order.user_id.name]:
                               salesmen_detail[each_order.user_id.name][month_year] = {}
                               for payment_line in each_order.statement_ids:
                                   if payment_line.statement_id.journal_id.name in salesmen_detail[each_order.user_id.name][month_year]:
                                       payment = salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name]
                                       payment += payment_line.amount
                                   else:
                                       payment = payment_line.amount
                                   salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name] = float(
                                   format(payment, '2f'));
                           else:
                               for payment_line in each_order.statement_ids:
                                   if payment_line.statement_id.journal_id.name in salesmen_detail[each_order.user_id.name][month_year]:
                                       payment = salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name]
                                       payment += payment_line.amount
                                   else:
                                       payment = payment_line.amount
                                   salesmen_detail[each_order.user_id.name][month_year][payment_line.statement_id.journal_id.name] = float(
                                   format(payment, '2f'));
        return {
                    'journal_details':journals_detail,
                    'salesmen_details':salesmen_detail,
                    'summary_data':summary_data
               }

    @api.model
    def product_summary_report(self,vals):
        if(vals):
            product_summary_dict = {}
            category_summary_dict = {}
            payment_summary_dict = {}
            location_summary_dict = {}
            product_qty = 0
            location_qty = 0
            category_qty = 0
            payment = 0
            order_detail = self.env['pos.order'].search([('date_order', '>=', vals.get('start_date')),
                                                         ('date_order', '<=', vals.get('end_date'))
                                                         ])
            if('product_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if(order_detail):
                    for each_order in order_detail:
                        for each_order_line in each_order.lines:
                            if each_order_line.product_id.name in product_summary_dict:
                                product_qty = product_summary_dict[each_order_line.product_id.name ]
                                product_qty += each_order_line.qty
                            else:
                                product_qty = each_order_line.qty
                            product_summary_dict[each_order_line.product_id.name] = product_qty;

            if ('category_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if (order_detail):
                    for each_order in order_detail:
                        for each_order_line in each_order.lines:
                            if each_order_line.product_id.pos_categ_id.name in category_summary_dict:
                                category_qty = category_summary_dict[each_order_line.product_id.pos_categ_id.name]
                                category_qty += each_order_line.qty
                            else:
                                category_qty = each_order_line.qty
                            category_summary_dict[each_order_line.product_id.pos_categ_id.name] = category_qty;
                    if(False in category_summary_dict):
                        category_summary_dict['Others'] = category_summary_dict.pop(False);

            if('payment_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if (order_detail):
                    for each_order in order_detail:
                       for payment_line in each_order.statement_ids:
                            if payment_line.statement_id.journal_id.name in payment_summary_dict:
                                payment = payment_summary_dict[payment_line.statement_id.journal_id.name]
                                payment += payment_line.amount
                            else:
                                payment = payment_line.amount
                            payment_summary_dict[payment_line.statement_id.journal_id.name] = float(format(payment,'2f'));

            if ('location_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                location_list = []
                for each_order in order_detail:
                    location_summary_dict[each_order.picking_id.location_id.name] = {}
                for each_order in order_detail:
                    for each_order_line in each_order.lines:
                        if each_order_line.product_id.name in location_summary_dict[each_order.picking_id.location_id.name]:
                            location_qty = location_summary_dict[each_order.picking_id.location_id.name][
                            each_order_line.product_id.name]
                            location_qty += each_order_line.qty
                        else:
                            location_qty = each_order_line.qty
                        location_summary_dict[each_order.picking_id.location_id.name][each_order_line.product_id.name] = location_qty
                location_list.append(location_summary_dict)

        return {
                'product_summary':product_summary_dict,
                'category_summary':category_summary_dict,
                'payment_summary':payment_summary_dict,
                'location_summary':location_summary_dict,
                }

    @api.model
    def order_summary_report(self,vals):
        order_list = {}
        order_list_sorted = []
        category_list = {}
        payment_list = {}
        if(vals):
            if(vals['state'] == ''):
                if('order_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date'))])
                    for each_order in orders:
                        order_list[each_order.state] = []
                    for each_order in orders:
                        if each_order.state in order_list:
                            order_list[each_order.state].append({
                                'order_ref':each_order.name,
                                'order_date': each_order.date_order,
                                'total': float(format(each_order.amount_total,'.2f'))
                            })
                        else:
                            order_list.update({
                            each_order.state.append({
                                'order_ref':each_order.name,
                                'order_date': each_order.date_order,
                                'total': float(format(each_order.amount_total,'.2f'))
                            })
                        })
                if('category_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    count = 0.00
                    amount = 0.00
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date'))])
                    for each_order in orders:
                        category_list[each_order.state] = {}
                    for each_order in orders:
                        for order_line in each_order.lines:
                            if each_order.state == 'paid':
                                if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                    count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                    amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                    count += order_line.qty
                                    amount += order_line.price_subtotal_incl
                                else:
                                    count = order_line.qty
                                    amount = order_line.price_subtotal_incl
                            if each_order.state == 'done':
                                if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                    count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                    amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                    count += order_line.qty
                                    amount += order_line.price_subtotal_incl
                                else:
                                    count = order_line.qty
                                    amount = order_line.price_subtotal_incl
                            if each_order.state == 'invoiced':
                                if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                    count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                    amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                    count += order_line.qty
                                    amount += order_line.price_subtotal_incl
                                else:
                                    count = order_line.qty
                                    amount = order_line.price_subtotal_incl
                            category_list[each_order.state].update({order_line.product_id.pos_categ_id.name:[count,amount]})
                        if(False in category_list[each_order.state]):
                            category_list[each_order.state]['others'] = category_list[each_order.state].pop(False)

                if('payment_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    count = 0
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date'))])
                    for each_order in orders:
                        payment_list[each_order.state] = {}
                    for each_order in orders:
                        for payment_line in each_order.statement_ids:
                            if each_order.state == 'paid':
                                if payment_line.journal_id.name in payment_list[each_order.state]:
                                    count = payment_list[each_order.state][payment_line.journal_id.name]
                                    count += payment_line.amount
                                else:
                                    count = payment_line.amount
                            if each_order.state == 'done':
                                if payment_line.journal_id.name in payment_list[each_order.state]:
                                    count = payment_list[each_order.state][payment_line.journal_id.name]
                                    count += payment_line.amount
                                else:
                                    count = payment_line.amount
                            if each_order.state == 'invoiced':
                                if payment_line.journal_id.name in payment_list[each_order.state]:
                                    count = payment_list[each_order.state][payment_line.journal_id.name]
                                    count += payment_line.amount
                                else:
                                    count = payment_line.amount
                            payment_list[each_order.state].update({payment_line.journal_id.name:float(format(count,'.2f'))})
                return {'order_report':order_list,'category_report':category_list,'payment_report':payment_list,'state':vals['state']}
            else:
                order_list =[]
                if('order_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date')),('state', '=', vals.get('state'))])
                    for each_order in orders:
                        order_list.append({
                        'order_ref':each_order.name,
                        'order_date': each_order.date_order,
                        'total': float(format(each_order.amount_total,'.2f'))
                        })
                    order_list_sorted = sorted(order_list, key=itemgetter('order_ref')) 

                if('category_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    count = 0.00
                    amount = 0.00
                    values = []
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date')),('state', '=', vals.get('state'))])
                    for each_order in orders:
                        for order_line in each_order.lines:
                            if order_line.product_id.pos_categ_id.name in category_list:
                                count = category_list[order_line.product_id.pos_categ_id.name][0]
                                amount = category_list[order_line.product_id.pos_categ_id.name][1]
                                count += order_line.qty
                                amount += order_line.price_subtotal_incl
                            else:
                                count = order_line.qty
                                amount = order_line.price_subtotal_incl
                            category_list.update({order_line.product_id.pos_categ_id.name:[count,amount] })
                    if(False in category_list):
                        category_list['others'] = category_list.pop(False)
                if('payment_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                    count = 0
                    orders = self.search([('date_order', '>=', vals.get('start_date')), ('date_order', '<=', vals.get('end_date')),('state', '=', vals.get('state'))])
                    for each_order in orders:
                        for payment_line in each_order.statement_ids:
                            if payment_line.journal_id.name in payment_list:
                                count = payment_list[payment_line.journal_id.name]
                                count += payment_line.amount
                            else:
                                count = payment_line.amount
                            payment_list.update({payment_line.journal_id.name:float(format(count,'.2f')) })
            return {
                'order_report':order_list_sorted,
                'category_report':category_list,
                'payment_report':payment_list,
                'state':vals['state']
            }

    customer_email = fields.Char('Customer Email')
    parent_return_order = fields.Char('Return Order ID', size=64)
    return_seq = fields.Integer('Return Sequence')
    return_process = fields.Boolean('Return Process')
    back_order = fields.Char('Back Order', size=256, default=False, copy=False)
    is_rounding = fields.Boolean("Is Rounding")
    rounding_option = fields.Char("Rounding Option")
    rounding = fields.Float(string='Rounding', digits=0)
    delivery_date = fields.Char("Delivery Date")
    delivery_time = fields.Char("Delivery Time")
    delivery_address = fields.Char("Delivery Address")
    delivery_charge_amt = fields.Float("Delivery Charge")
    total_loyalty_earned_points = fields.Float("Earned Loyalty Points")
    total_loyalty_earned_amount = fields.Float("Earned Loyalty Amount")
    total_loyalty_redeem_points = fields.Float("Redeemed Loyalty Points")
    total_loyalty_redeem_amount = fields.Float("Redeemed Loyalty Amount")
    picking_ids = fields.Many2many(
            "stock.picking",
            string="Multiple Picking",
            copy=False)
    reserved = fields.Boolean("Reserved", readonly=True)
    partial_pay = fields.Boolean("Partial Pay", readonly=True)
    order_booked = fields.Boolean("Booked", readonly=True)
    unreserved = fields.Boolean("Unreserved")
    amount_due = fields.Float(string='Amount Due', compute='_compute_amount_due')
    reserve_delivery_date = fields.Date(string="Reserve Delivery Date")
    cancel_order = fields.Char('Cancel Order')
    order_status = fields.Selection([('full', 'Fully Cancelled'), ('partial', 'Partially Cancelled')],
                                    'Order Status', compute="_find_order_status")
    fresh_order = fields.Boolean("Fresh Order")
    shop_id = fields.Many2one("pos.shop", string="Shop")
    # Credit
    is_delivery = fields.Boolean(string='Deliver')
    # Debit
    is_debit = fields.Boolean(string="Is Debit")


class pos_order_line(models.Model):
    _inherit = 'pos.order.line'

    @api.model
    def create(self, values):
        if values.get('product_id') and not values.get('from_credit'):
            if self.env['pos.order'].browse(values['order_id']).session_id.config_id.prod_for_payment.id == values.get('product_id'):
                return
            if self.env['pos.order'].browse(values['order_id']).session_id.config_id.refund_amount_product_id.id == values.get('product_id'):
                return
        if values.get('cancel_item_id'):
            line_id = self.browse(values.get('cancel_item_id'))
            if line_id and values.get('new_line_status'):
                values.update({'line_status': values.get('new_line_status')})
        res = super(pos_order_line, self).create(values)
        return res

    cancel_item = fields.Boolean("Cancel Item")
    cost_price = fields.Float("Cost")
    line_status = fields.Selection([('nothing', 'Nothing'), ('full', 'Fully Cancelled'), ('partial', 'Partially Cancelled')],
                                    'Order Status', default="nothing")
    line_note = fields.Char('Comment', size=512)
    deliver = fields.Boolean("Is deliver")
    return_qty = fields.Integer('Return QTY', size=64)
    return_process = fields.Char('Return Process')
    back_order = fields.Char('Back Order', size=256, default=False, copy=False)
    location_id = fields.Many2one('stock.location', string='Location')
    serial_nums = fields.Char("Serials")


class quick_cash_payment(models.Model):
    _name = "quick.cash.payment"
 
    name = fields.Float(string='Amount')

    _sql_constraints = [
        ('quick_cash_payment', 'unique(name)', 'This amount already selected'),
    ]


class pos_session(models.Model):
    _inherit = 'pos.session'

    current_cashier_id  = fields.Many2one('res.users' ,string="Cashier" ,readonly=True)
    locked = fields.Boolean("Locked" )
    locked_by_user_id = fields.Many2one('res.users' ,string="Locked By")

    cashcontrol_ids = fields.One2many(comodel_name="custom.cashcontrol", inverse_name="pos_session_id",
                                 string="Cash Control Information")
    opening_balance = fields.Boolean(string="Opening Balance")
    shop_id = fields.Many2one('pos.shop', string='Shop',related='config_id.multi_shop_id')

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        user_rec = self.env['res.users'].browse(self._uid)
        erp_manager_id = self.env['ir.model.data'].get_object_reference('base',
                                                                        'group_erp_manager')[1]
        if user_rec and erp_manager_id not in user_rec.groups_id.ids:
            if user_rec.shop_ids:
                args += ['|', ('shop_id', 'in', user_rec.shop_ids.ids), ('shop_id', '=', False)]
            res = super(pos_session, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        else:
            res = super(pos_session, self).search(args=args, offset=offset, limit=limit, order=order, count=count)
        return res

    @api.multi
    def get_products_category_data(self, flag_config):
        product_list = []
        category_list = []
        if self.shop_id and self.shop_id.location_id.product_ids:
            for product in self.shop_id.location_id.product_ids:
                product_list.append(product.id)
        if self.shop_id and self.shop_id.location_id.category_ids:
            for cat in self.shop_id.location_id.category_ids:
                category_list.append(cat.id)
        dummy_products = self.env['product.product'].sudo().with_context(
            {'location': self.config_id.stock_location_id.id}).search([('is_dummy_product', '=', True)]).ids
        if flag_config == False:
            domain = ['|', ('is_dummy_product', '=', True), ('sale_ok', '=', True), ('available_in_pos', '=', True)]
        else:
            domain = ['|', '|', ('is_dummy_product', '=', True), ('id', 'in', product_list),
                      ('pos_categ_id', 'in', category_list), ('sale_ok', '=', True), ('available_in_pos', '=', True)]
        product_records = self.env['product.product'].sudo().with_context(
            {'location': self.config_id.stock_location_id.id}).search(domain).ids
        if not product_records or len(dummy_products) >= len(product_records):
            domain = [('sale_ok', '=', True), ('available_in_pos', '=', True)]
            product_records = self.env['product.product'].sudo().with_context(
                {'location': self.config_id.stock_location_id.id}).search(domain).ids
        return product_records

    @api.multi
    def get_pos_name(self):
        if self and self.config_id:
            return self.config_id.name

    @api.multi
    def get_inventory_details(self):
        product_category = self.env['product.category'].search([])
        product_product = self.env['product.product']
        stock_location = self.config_id.stock_location_id;
        inventory_records = []
        final_list = []
        product_details = []
        if self and self.id:
            for order in self.order_ids:
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
        for each in custom_list:
            product_id = product_product.browse(each.get('id'))
            if product_id:
                inventory_records.append({
                    'product_id': [product_id.id, product_id.name],
                    'category_id': [product_id.id, product_id.categ_id.name],
                    'used_qty': each.get('qty'),
                    'quantity': product_id.with_context(
                        {'location': stock_location.id, 'compute_child': False}).qty_available,
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
                                qty = rec.get('quantity') + each.get('quantity')
                                rec.update({'quantity': qty})
                final_list = sorted(temp_obj, key=lambda k: k['quantity'])
        return final_list or []

    @api.multi
    def custom_close_pos_session(self):
        self._check_pos_session_balance()
        for session in self:
            session.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})
            if not session.config_id.cash_control:
                session.action_pos_session_close()
                return True
            if session.config_id.cash_control:
                self._check_pos_session_balance()
                return self.action_pos_session_close()

    @api.multi
    def close_open_balance(self):
        self.write({'opening_balance': False})
        return True

    @api.multi
    def cash_control_line(self,vals):
        total_amount = 0.00
        if vals:
            self.cashcontrol_ids.unlink()
            for data in vals:
                self.env['custom.cashcontrol'].create(data)
        for cash_line in self.cashcontrol_ids:
            total_amount += cash_line.subtotal
        for statement in self.statement_ids:
            statement.write({'balance_end_real': total_amount})
        return True

    @api.multi
    def open_balance(self, vals):
        for statement in self.statement_ids:
            statement.write({'balance_start': vals})
        self.write({'opening_balance':False})
        return True

    def _confirm_orders(self):
        for session in self:
            company_id = session.config_id.journal_id.company_id.id
            orders = session.order_ids.filtered(lambda order: order.state == 'paid')
            journal_id = self.env['ir.config_parameter'].sudo().get_param(
                'pos.closing.journal_id_%s' % company_id, default=session.config_id.journal_id.id)

            move = self.env['pos.order'].with_context(force_company=company_id)._create_account_move(session.start_at, session.name, int(journal_id), company_id)
            orders.with_context(force_company=company_id)._create_account_move_line(session, move)
            for order in session.order_ids.filtered(lambda o: o.state not in ['done', 'invoiced']):
                if order.state not in ('draft'):
                    # raise UserError(_("You cannot confirm all orders of this session, because they have not the 'paid' status"))
                    order.action_pos_order_done()

    @api.multi
    def action_pos_session_open(self):
        pos_order = self.env['pos.order'].search([('state', '=', 'draft')])
        for order in pos_order:
            if order.session_id.state != 'opened':
                order.write({'session_id': self.id})
        return super(pos_session, self).action_pos_session_open()

    @api.model
    def get_proxy_ip(self):
        proxy_id = self.env['res.users'].browse([self._uid]).company_id.report_ip_address
        return {'ip': proxy_id or False}

    @api.multi
    def get_user(self):
        if self._uid == SUPERUSER_ID:
            return True

    @api.multi
    def get_gross_total(self):
        gross_total = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    gross_total += line.qty * (line.price_unit - line.product_id.standard_price)
        return gross_total

    @api.multi
    def get_product_cate_total(self):
        balance_end_real = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    balance_end_real += (line.qty * line.price_unit)
        return balance_end_real

    @api.multi
    def get_net_gross_total(self):
        net_gross_profit = 0.0
        if self:
            net_gross_profit = self.get_gross_total() - self.get_total_tax()
        return net_gross_profit

    @api.multi
    def get_product_name(self, category_id):
        if category_id:
            category_name = self.env['pos.category'].browse([category_id]).name
            return category_name

    @api.multi
    def get_payments(self):
        if self:
            statement_line_obj = self.env["account.bank.statement.line"]
            pos_order_obj = self.env["pos.order"]
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('state','in',['paid','invoiced','done']),
                                            ('company_id', '=', company_id),('session_id','=',self.id)])
            data={}
            if pos_ids:
                pos_ids = [pos.id for pos in pos_ids]
                st_line_ids = statement_line_obj.search([('pos_statement_id', 'in', pos_ids)])
                if st_line_ids:
                    a_l=[]
                    for r in st_line_ids:
                        a_l.append(r['id'])
                    self._cr.execute("select aj.name,sum(amount) from account_bank_statement_line as absl,account_bank_statement as abs,account_journal as aj " \
                                    "where absl.statement_id = abs.id and abs.journal_id = aj.id  and absl.id IN %s " \
                                    "group by aj.name ",(tuple(a_l),))

                    data = self._cr.dictfetchall()
                    return data
            else:
                return {}

    @api.multi
    def get_product_category(self):
        product_list = []
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    flag = False
                    product_dict = {}
                    for lst in product_list:
                        if line.product_id.pos_categ_id:
                            if lst.get('pos_categ_id') == line.product_id.pos_categ_id.id:
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                flag = True
                        else:
                            if lst.get('pos_categ_id') == '':
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                flag = True
                    if not flag:
                        product_dict.update({
                                    'pos_categ_id': line.product_id.pos_categ_id and line.product_id.pos_categ_id.id or '',
                                    'price': (line.qty * line.price_unit)
                                })
                        product_list.append(product_dict)
        return product_list

    @api.multi
    def get_journal_amount(self):
        journal_list = []
        if self and self.statement_ids:
            for statement in self.statement_ids:
                journal_dict = {}
                journal_dict.update({'journal_id': statement.journal_id and statement.journal_id.name or '',
                                     'ending_bal': statement.balance_end_real or 0.0})
                journal_list.append(journal_dict)
        return journal_list

    @api.multi
    def get_total_closing(self):
        if self:
            return self.cash_register_balance_end_real

    @api.multi
    def get_total_sales(self):
        total_price = 0.0
        if self:
            for order in self.order_ids:
                total_price += sum([(line.qty * line.price_unit) for line in order.lines])
        return total_price

    @api.multi
    def get_total_tax(self):
        total_tax = 0.0
        if self:
            pos_order_obj = self.env['pos.order']
            total_tax += sum([order.amount_tax for order in pos_order_obj.search([('session_id', '=', self.id)])])
        return total_tax

    @api.multi
    def get_vat_tax(self):
        taxes_info = []
        if self:
            tax_list = []
            tax_list = [tax.id for order in self.order_ids for line in order.lines.filtered(lambda line: line.tax_ids_after_fiscal_position) for tax in line.tax_ids_after_fiscal_position]
            tax_list = list(set(tax_list))
            for tax in self.env['account.tax'].browse(tax_list):
                total_tax = 0.00
                net_total = 0.00
                for line in self.env['pos.order.line'].search([('order_id', 'in', [order.id for order in self.order_ids])]).filtered(lambda line: tax in line.tax_ids_after_fiscal_position ):
                    total_tax += line.price_subtotal * tax.amount / 100
                    net_total += line.price_subtotal
                taxes_info.append({
                    'tax_name': tax.name,
                    'tax_total': total_tax,
                    'tax_per': tax.amount,
                    'net_total': net_total,
                    'gross_tax': total_tax + net_total
                })
        return taxes_info

    @api.multi
    def get_total_discount(self):
        total_discount = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                total_discount += sum([((line.qty * line.price_unit) * line.discount) / 100 for line in order.lines])
        return total_discount

    @api.multi
    def get_total_first(self):
        total = 0.0
        if self:
            total = (self.get_total_sales() + self.get_total_tax())\
                - (abs(self.get_total_discount()))
        return total

    @api.multi
    def get_session_date(self, date_time):
        if date_time:
            if self._context and self._context.get('tz'):
                tz = timezone(self._context.get('tz'))
            else:
                tz = pytz.utc
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            if sign == '+':
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) + \
                                                    timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) - \
                                                    timedelta(hours=hour_tz, minutes=min_tz)
            return date_time.strftime('%d/%m/%Y %I:%M:%S %p')

    @api.multi
    def get_session_time(self, date_time):
        if date_time:
            if self._context and self._context.get('tz'):
                tz = timezone(self._context.get('tz'))
            else:
                tz = pytz.utc
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            if sign == '+':
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) + \
                                                    timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) - \
                                                    timedelta(hours=hour_tz, minutes=min_tz)
            return date_time.strftime('%I:%M:%S %p')

    @api.multi
    def get_current_date(self):
        if self._context and self._context.get('tz'):
            tz = self._context['tz']
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
#             tz = timezone(tz)
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    @api.multi
    def get_current_time(self):
        if self._context and self._context.get('tz'):
            tz = self._context['tz']
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
#             tz = timezone(tz)
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')

    @api.multi
    def get_company_data_x(self):
        return self.user_id.company_id

    @api.multi
    def get_current_date_x(self):
        if self._context and self._context.get('tz'):
            tz = self._context['tz']
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
#             tz = timezone(tz)
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    @api.multi
    def get_session_date_x(self, date_time):
        if date_time:
            if self._context and self._context.get('tz'):
                tz = self._context['tz']
                tz = timezone(tz)
            else:
                tz = pytz.utc
            if tz:
#                 tz = timezone(tz)
                c_time = datetime.now(tz)
                hour_tz = int(str(c_time)[-5:][:2])
                min_tz = int(str(c_time)[-5:][3:])
                sign = str(c_time)[-6][:1]
                if sign == '+':
                    date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) + \
                                                        timedelta(hours=hour_tz, minutes=min_tz)
                else:
                    date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) - \
                                                        timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT)
            return date_time.strftime('%d/%m/%Y')

    @api.multi
    def get_current_time_x(self):
        if self._context and self._context.get('tz'):
            tz = self._context['tz']
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
#             tz = timezone(tz)
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')

    @api.multi
    def get_session_time_x(self, date_time):
        if date_time:
            if self._context and self._context.get('tz'):
                tz = self._context['tz']
                tz = timezone(tz)
            else:
                tz = pytz.utc
            if tz:
#                 tz = timezone(tz)
                c_time = datetime.now(tz)
                hour_tz = int(str(c_time)[-5:][:2])
                min_tz = int(str(c_time)[-5:][3:])
                sign = str(c_time)[-6][:1]
                if sign == '+':
                    date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) + \
                                                        timedelta(hours=hour_tz, minutes=min_tz)
                else:
                    date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT) - \
                                                        timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT)
            return date_time.strftime('%I:%M:%S %p')

    @api.multi
    def get_total_sales_x(self):
        total_price = 0.0
        if self:
            for order in self.order_ids:
                    for line in order.lines:
                            total_price += (line.qty * line.price_unit)
        return total_price

    @api.multi
    def get_total_returns_x(self):
        pos_order_obj = self.env['pos.order']
        total_return = 0.0
        if self:
            for order in pos_order_obj.search([('session_id', '=', self.id)]):
                if order.amount_total < 0:
                    total_return += abs(order.amount_total)
        return total_return

    @api.multi
    def get_total_tax_x(self):
        total_tax = 0.0
        if self:
            pos_order_obj = self.env['pos.order']
            total_tax += sum([order.amount_tax for order in pos_order_obj.search([('session_id', '=', self.id)])])
        return total_tax

    @api.multi
    def get_total_discount_x(self):
        total_discount = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                total_discount += sum([((line.qty * line.price_unit) * line.discount) / 100 for line in order.lines])
        return total_discount
    
    @api.multi
    def get_total_first_x(self):
        global gross_total
        if self:
            gross_total = (self.get_total_sales() + self.get_total_tax()) \
                 + self.get_total_discount()
        return gross_total

    @api.multi
    def get_user_x(self):
        if self._uid == SUPERUSER_ID:
            return True

    @api.multi
    def get_gross_total_x(self):
        total_cost = 0.0
        gross_total = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    total_cost += line.qty * line.product_id.standard_price
        gross_total = self.get_total_sales() - \
                    + self.get_total_tax() - total_cost
        return gross_total

    @api.multi
    def get_net_gross_total_x(self):
        net_gross_profit = 0.0
        total_cost = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    total_cost += line.qty * line.product_id.standard_price
            net_gross_profit = self.get_total_sales() - self.get_total_tax() - total_cost
        return net_gross_profit

    @api.multi
    def get_product_cate_total_x(self):
        balance_end_real = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    balance_end_real += (line.qty * line.price_unit)
        return balance_end_real

    @api.multi
    def get_product_name_x(self, category_id):
        if category_id:
            category_name = self.env['pos.category'].browse([category_id]).name
            return category_name

    @api.multi
    def get_product_category_x(self):
        product_list = []
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    flag = False
                    product_dict = {}
                    for lst in product_list:
                        if line.product_id.pos_categ_id:
                            if lst.get('pos_categ_id') == line.product_id.pos_categ_id.id:
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
#                                 if line.product_id.pos_categ_id.show_in_report:
                                lst['qty'] = lst.get('qty') or 0.0 + line.qty
                                flag = True
                        else:
                            if lst.get('pos_categ_id') == '':
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                lst['qty'] = lst.get('qty') or 0.0 + line.qty
                                flag = True
                    if not flag:
                        if line.product_id.pos_categ_id:
                            product_dict.update({
                                        'pos_categ_id': line.product_id.pos_categ_id and line.product_id.pos_categ_id.id or '',
                                        'price': (line.qty * line.price_unit),
                                        'qty': line.qty
                                    })
                        else:
                            product_dict.update({
                                        'pos_categ_id': line.product_id.pos_categ_id and line.product_id.pos_categ_id.id or '',
                                        'price': (line.qty * line.price_unit),
                                    })
                        product_list.append(product_dict)
        return product_list

    @api.multi
    def get_payments_x(self):
        if self:
            statement_line_obj = self.env["account.bank.statement.line"]
            pos_order_obj = self.env["pos.order"]
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('session_id', '=', self.id),
                                            ('state', 'in', ['paid', 'invoiced', 'done']),
                                            ('user_id', '=', self.user_id.id), ('company_id', '=', company_id)])
            data = {}
            if pos_ids:
                pos_ids = [pos.id for pos in pos_ids]
                st_line_ids = statement_line_obj.search([('pos_statement_id', 'in', pos_ids)])
                if st_line_ids:
                    a_l = []
                    for r in st_line_ids:
                        a_l.append(r['id'])
                    self._cr.execute("select aj.name,sum(amount) from account_bank_statement_line as absl,account_bank_statement as abs,account_journal as aj " \
                                    "where absl.statement_id = abs.id and abs.journal_id = aj.id  and absl.id IN %s " \
                                    "group by aj.name ", (tuple(a_l),))

                    data = self._cr.dictfetchall()
                    return data
            else:
                return {}

    is_lock_screen = fields.Boolean(string="Lock Screen")

    @api.model
    def get_session_report(self):
        try:
#             sql query for get "In Progress" session
            self._cr.execute("""
                select ps.id,pc.name, ps.name from pos_session ps
                left join pos_config pc on (ps.config_id = pc.id)
                where ps.state='opened'
            """)
            session_detail = self._cr.fetchall()
# 
            self._cr.execute("""
                SELECT pc.name, ps.name, sum(absl.amount) FROM pos_session ps
                JOIN pos_config pc on (ps.config_id = pc.id)
                JOIN account_bank_statement_line absl on (ps.name = absl.ref)
                WHERE ps.state='opened'
                GROUP BY ps.id, pc.name;
            """)
            session_total = self._cr.fetchall()
#             sql query for get payments total of "In Progress" session
            lst = []
            for pay_id in session_detail:
                self._cr.execute("""
                    select pc.name, aj.name, abs.total_entry_encoding from account_bank_statement abs
                    join pos_session ps on abs.pos_session_id = ps.id
                    join pos_config pc on ps.config_id = pc.id
                    join account_journal aj on  abs.journal_id = aj.id
                    where pos_session_id=%s
                """%pay_id[0])
                bank_detail = self._cr.fetchall()
                for i in bank_detail:
                    if i[2] != None:
                        lst.append({'session_name':i[0],'journals':i[1],'total':i[2]})

            cate_lst = []
            for cate_id in session_detail:
                self._cr.execute("""
                    select pc.name, sum(pol.price_unit), poc.name from pos_category pc
                    join product_template pt on pc.id = pt.pos_categ_id
                    join product_product pp on pt.id = pp.product_tmpl_id
                    join pos_order_line pol on pp.id = pol.product_id
                    join pos_order po on pol.order_id = po.id
                    join pos_session ps on ps.id = po.session_id
                    join pos_config poc ON ps.config_id = poc.id
                    where po.session_id = %s
                    group by pc.name, poc.name
                """%cate_id[0])
                cate_detail = self._cr.fetchall()
                for j in cate_detail:
                    cate_lst.append({'cate_name':j[0],'cate_total':j[1],'session_name':j[2]})
            categ_null = []
            for cate_id_null in session_detail:
                self._cr.execute(""" 
                    select sum(pol.price_unit), poc.name from pos_order_line pol
                    join pos_order po on po.id = pol.order_id
                    join product_product pp on pp.id = pol.product_id
                    join product_template pt on pt.id = pp.product_tmpl_id
                    join pos_session ps on ps.id = po.session_id
                    join pos_config poc on ps.config_id = poc.id
                    where po.session_id = %s and pt.pos_categ_id is null
                    group by poc.name
                """%cate_id_null[0])
                categ_null_detail = self._cr.fetchall()
                for k in categ_null_detail:
                    categ_null.append({'cate_name':'Undefined Category','cate_total':k[0],'session_name':k[1]})
            all_cat = []
            for sess in session_total:
                def_cate_lst = []
                for j in cate_lst:
                    if j['session_name'] == sess[0]:
                        def_cate_lst.append(j)
                for k in categ_null:
                    if k['session_name'] == sess[0]:
                        def_cate_lst.append(k)
                all_cat.append(def_cate_lst)
            return {'session_total':session_total,'payment_lst':lst,'all_cat':all_cat}
        except Exception as e:
           return {'error':'Error Function Working'}

    @api.model
    def cash_in_out_operation(self, vals):
        cash_obj = False
        if vals:
            if vals.get('operation') == "put_money":
                cash_obj = self.env['cash.box.in']
            elif vals.get('operation') == "take_money":
                cash_obj = self.env['cash.box.out']
        session_id = self.env['pos.session'].browse(vals.get('session_id'))
        if session_id:
            for session in session_id:
                bank_statements = [session.cash_register_id for session in session_id if session.cash_register_id]
            if not bank_statements:
                return  {'error': _('There is no cash register for this PoS Session')}
            cntx = {'active_id':session_id.id,'uid':vals.get('cashier')}
            res = cash_obj.with_context(cntx).create({'name': vals.get('name'), 'amount': vals.get('amount')})
            return res._run(bank_statements)
        return {'error': _('There is no cash register for this PoS Session')}

#     @api.model
#     def take_money_out(self, name, amount, session_id):
#         try:
#             cash_out_obj = self.env['cash.box.out']
#             total_amount = 0.0
#             active_model = 'pos.session'
#             active_ids = [session_id]
#             if active_model == 'pos.session':
#                 records = self.env[active_model].browse(active_ids)
#                 bank_statements = [record.cash_register_id for record in records if record.cash_register_id]
#                 if not bank_statements:
#                     raise Warning(_('There is no cash register for this PoS Session'))
#                 res = cash_out_obj.create({'name': name, 'amount': amount})
#                 return res._run(bank_statements)
#             else:
#                 return {}
#         except Exception as e:
#            return {'error':'There is no cash register for this PoS Session '}
# 
#     @api.model
#     def put_money_in(self, name, amount, session_id):
#         try:
#             cash_out_obj = self.env['cash.box.in']
#             total_amount = 0.0
#             active_model = 'pos.session'
#             active_ids = [session_id]
#             if active_model == 'pos.session':
#                 records = self.env[active_model].browse(active_ids)
#                 bank_statements = [record.cash_register_id for record in records if record.cash_register_id]
#                 if not bank_statements:
#                     raise Warning(_('There is no cash register for this PoS Session'))
#                 res = cash_out_obj.create({'name': name, 'amount': amount})
#                 return res._run(bank_statements)
#             else:
#                 return {}
#         except Exception as e:
#             return {'error':e}

    @api.one
    @api.constrains('amount')
    def _check_amount(self):
        if not self._context.get('from_pos'):
            super(AccountBankStatementLine, self)._check_amount()

    @api.one
    @api.constrains('amount', 'amount_currency')
    def _check_amount_currency(self):
        if not self._context.get('from_pos'):
            super(AccountBankStatementLine, self)._check_amount_currency()

class CashControl(models.Model):
    _name = 'custom.cashcontrol'

    coin_value = fields.Float(string="Coin/Bill Value")
    number_of_coins = fields.Integer(string="Number of Coins")
    subtotal = fields.Float(string="Subtotal")
    pos_session_id = fields.Many2one(comodel_name='pos.session',string="Session Id")

class cash_in_out_history(models.Model):
    _name = 'cash.in.out.history'

    user_id = fields.Many2one('res.users', string='User ID')
    session_id = fields.Many2one('pos.session', String="Session ID")
    amount = fields.Float("Amount")
    operation = fields.Selection([('Dr', 'Dr'), ('Cr', 'Cr')], string="Operation")


# Put money in from backend
class PosBoxIn(CashBox):
    _inherit = 'cash.box.in'

    @api.model
    def create(self, vals):
        res = super(PosBoxIn, self).create(vals)
        cash_out_obj_history = self.env['cash.in.out.history']
        if res and self._context:
            user_id = self._context.get('uid')
            session_record_id = self._context.get('active_id')
            history_val = {'user_id': user_id, 'session_id': session_record_id, 'amount': vals.get('amount'),
                           'operation': 'Cr'}
            cash_out_obj_history.create(history_val)
        return res


# Take money out from backend
class PosBoxOut(CashBox):
    _inherit = 'cash.box.out'

    @api.model
    def create(self, vals):
        res = super(PosBoxOut, self).create(vals)
        cash_out_obj_history = self.env['cash.in.out.history']
        if res and self._context:
            user_id = self._context.get('uid')
            session_record_id = self._context.get('active_id')
            history_val = {'user_id': user_id, 'session_id': session_record_id, 'amount': vals.get('amount'),
                           'operation': 'Dr'}
            cash_out_obj_history.create(history_val)
        return res


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    @api.model
    def get_html_report(self, id, report_name):
        report = self._get_report_from_name(report_name)
        document = report.render_qweb_html([id], data={})
        if document:
            return document
        return False

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: