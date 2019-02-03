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

import json

from odoo import http
from odoo.http import request
from odoo.tools.translate import _
import werkzeug.utils
import hashlib
from odoo import http
from odoo.http import request
import json
from odoo.addons.web.controllers.main import Home, ensure_db
from odoo.addons.bus.controllers.main import BusController

import logging

_logger = logging.getLogger(__name__)


class Home(Home):
    @http.route('/web/login', type='http', auth="none", sitemap=False)
    def web_login(self, redirect=None, **kw):
        res = super(Home, self).web_login(redirect, **kw)
        if request.params['login_success']:
            uid = request.session.authenticate(request.session.db, request.params['login'], request.params['password'])
            users = request.env['res.users'].browse([uid])
            if users.login_with_pos_screen:
                pos_session = request.env['pos.session'].sudo().search(
                    [('config_id', '=', users.default_pos.id), ('state', '=', 'opened')])
                if pos_session:
                    return http.redirect_with_hash('/pos/web')
                else:
                    session_id = users.default_pos.open_session_cb()
                    pos_session = request.env['pos.session'].sudo().search(
                        [('config_id', '=', users.default_pos.id), ('state', '=', 'opening_control')])
                    if users.default_pos.cash_control:
                        pos_session.write({'opening_balance': True})
                    session_open = pos_session.action_pos_session_open()
                    return http.redirect_with_hash('/pos/web')
            else:
                return res
        else:
            return res

class DataSet(http.Controller):

    @http.route('/web/dataset/get_country', type='http', auth="user")
    def get_country(self, **kw):
        cr, uid, context = request.cr, request.uid, request.context
        county_code = kw.get('country_code')
        country_obj = request.env['res.country']
        country_id = country_obj.search([('code','=',county_code)])
        if country_id:
#             return json.dumps(country_id.read())
            data = country_id.read()
            data[0]['image'] = False 
            return json.dumps(data)
        else:
            return False

    #load background
    @http.route('/web/dataset/load_products', type='http', auth="user")
    def load_products(self, **kw):
        cr, uid, context = request.cr, request.uid, request.context
        product_ids = eval(kw.get('product_ids'))
        fields = eval(kw.get('fields'))
        if product_ids and fields:
            records = request.env['product.product'].search_read([('id','in',product_ids)], fields)
            if records:
                return json.dumps(records)
        return json.dumps([])

#     @http.route('/web/dataset/get_update', type='http', auth="user")
#     def get_update(self, **kw):
#         cr, uid, context = request.cr, request.uid, request.context
#         sess_id = int(kw.get('check_session_id'))
#         if(kw.get('get_message')):
#             if sess_id :
#                 session_notify_message_data = request.env['message.terminal'].search([('message_session_id', '=',sess_id)],order="id desc",limit=1)
#                 if session_notify_message_data:
#                     return json.dumps(session_notify_message_data.read())
#         else:
#             cash_id = int(kw.get('current_cashier'))
#             cash_name = kw.get('cashier_name')
#             if sess_id and cash_id :
#                 session_notify_data = request.env['lock.data'].search([('session_id','=',sess_id),('locked_user_id', '=',cash_id)])
#                 if session_notify_data:
#                     return json.dumps(session_notify_data.read())
#         return []
    
class TerminalLockController(BusController):

    def _poll(self, dbname, channels, last, options):
        """Add the relevant channels to the BusController polling."""
        if options.get('lock.data'):
            channels = list(channels)
            lock_channel = (
                request.db,
                'lock.data',
                options.get('lock.data')
            )
            channels.append(lock_channel)
        return super(TerminalLockController, self)._poll(dbname, channels, last, options)


class CustomerDisplayController(BusController):

    def _poll(self, dbname, channels, last, options):
        """Add the relevant channels to the BusController polling."""
        if options.get('customer.display'):
            channels = list(channels)
            ticket_channel = (
                request.db,
                'customer.display',
                options.get('customer.display')
            )
            channels.append(ticket_channel)
        return super(CustomerDisplayController, self)._poll(dbname, channels, last, options)


class PosMirrorController(http.Controller):

    @http.route('/web/customer_display', type='http', auth='user')
    def white_board_web(self, **k):
        config_id = False
        pos_sessions = request.env['pos.session'].search([
            ('state', '=', 'opened'),
            ('user_id', '=', request.session.uid),
            ('rescue', '=', False)])
        if pos_sessions:
            config_id = pos_sessions.config_id.id
        context = {
            'session_info': json.dumps(request.env['ir.http'].session_info()),
            'config_id': config_id,
        }
        return request.render('flexipharmacy.customer_display_index', qcontext=context)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: