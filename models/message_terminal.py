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


class message_terminal(models.Model):
    _name = 'message.terminal'

    message_session_id = fields.Many2one('pos.session' ,string="Message To Session" ,readonly=True)
    receiver_user = fields.Many2one('res.users', string="Message To" ,readonly=True)
    sender_user = fields.Many2one('res.users', string="Message By User" ,readonly=True)
    message = fields.Text('Message')

    @api.model
    def broadcast_message_log(self,session_list,sender_user,message):
        if session_list and session_list[0]:
            list_of_rec = []
            for session in session_list:
                list_of_rec.append(self.create({
                            'message_session_id' : session.get('id'),
                            'receiver_user' : session.get('current_cashier_id')[0],
                            'sender_user' : sender_user,
                            'message' : message
                        }))
            return list_of_rec

    @api.model
    def delete_user_message(self,session_id):
        rec_messages = self.search([('message_session_id','=',session_id)])
        if rec_messages:
            for message in rec_messages:
                message.unlink(); 
        return True

    @api.model
    def create(self, vals):
        res = super(message_terminal, self).create(vals)
        res_users = self.env['res.users'].search([])
        notifications = []
        for user in res_users:
            notifications.append(((self._cr.dbname, 'lock.data', user.id), ('terminal_message', res.read())))
            self.env['bus.bus'].sendmany(notifications)
        return res
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: