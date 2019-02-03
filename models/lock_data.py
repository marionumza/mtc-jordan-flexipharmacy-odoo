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


class lock_data(models.Model):
    _name = 'lock.data'

    session_id  = fields.Many2one('pos.session' ,string="Session" ,readonly=True)
    locked_user_id = fields.Many2one('res.users', string="Locked User" ,readonly=True)
    locked_by_user_id = fields.Many2one('res.users', string="Locked By User" ,readonly=True)
    lock_status = fields.Boolean(string="Lock State" ,readonly=True)

    @api.model
    def lock_session_log(self,session_id,locked_user,user_locked_by,status):
        locked_by = user_locked_by.get('id')
        rec_session = self.search([('session_id','=',session_id)])
        session = self.env['pos.session'].browse(session_id)
        if rec_session.id :
            if rec_session.lock_status == True:
                if rec_session.locked_by_user_id.id == locked_by :
                    rec_session.write({
                            'locked_user_id' : locked_user,
                            'locked_by_user_id' : locked_by,
                            'lock_status' : status
                        })
                    session.write({'locked':status,'locked_by_user_id':False})
                    return session.read()
                else:
                    return False
            else:
                rec_session.write({
                        'locked_user_id' : locked_user,
                        'locked_by_user_id' : locked_by,
                        'lock_status' : status
                    })
                session.write({'locked':status,'locked_by_user_id':locked_by})
                return session.read()
        else :
            self.create({
                    'session_id' : session_id,
                    'locked_user_id' : locked_user,
                    'locked_by_user_id' : locked_by,
                    'lock_status' : status
                })
            session.write({'locked':status,'locked_by_user_id':locked_by})
            return session.read()

    @api.model
    def lock_unlock_all_session(self,sessions,user_locked_by,lock):
        locked_by = user_locked_by.get('id')
        if sessions:
            for session in sessions:
                session_rec = self.env['pos.session'].browse(session.get('id'))
                if lock:
                    if(session.get('locked') != True):
                        rec_session = self.search([('session_id','=',session.get('id'))])
                        if rec_session.id :
#                             record = self.browse(rec_session.id)
                            rec_session.write({
                                    'locked_user_id' : session.get('current_cashier_id')[0],
                                    'locked_by_user_id' : locked_by,
                                    'lock_status' : True
                                })
                            session_rec.write({'locked':True,'locked_by_user_id':locked_by})
                            session.update({'locked': True,'locked_by_user_id': [user_locked_by.get('id'),user_locked_by.get('name')]})
                        else:
                            self.create({
                                                        'session_id' : session.get('id'),
                                                        'locked_user_id' : session.get('current_cashier_id')[0],
                                                        'locked_by_user_id' : locked_by,
                                                        'lock_status' : True
                                                        })
                            session_rec.write({'locked':True,'locked_by_user_id':locked_by})
                            session.update({'locked': True,'locked_by_user_id': [user_locked_by.get('id'),user_locked_by.get('name')]})
                else:
                    if(session.get('locked') != False):
                        rec_session = self.search([('session_id','=',session.get('id'))])
                        if rec_session.id :
                            if rec_session.lock_status == True:
                                if rec_session.locked_by_user_id.id == locked_by :
#                                     record = self.browse(rec_session.id)
                                    rec_session.write({
                                            'locked_user_id' : session.get('current_cashier_id')[0],
                                            'locked_by_user_id' : locked_by,
                                            'lock_status' : False
                                        })
                                    session_rec.write({'locked':False,'locked_by_user_id':False})
                                    session.update({'locked': False,'locked_by_user_id': False})
#                                 else:
#                                     session_rec.write({'locked':True,'locked_by_user_id':rec_session.locked_by_user_id.id})
#                                     session.update({'locked': True,'locked_by_user_id': [rec_session.locked_by_user_id.id,user_locked_by.get('name')]})
                        else:
                            self.create({
                                                        'session_id' : session.get('id'),
                                                        'locked_user_id' : session.get('current_cashier_id')[0],
                                                        'locked_by_user_id' : locked_by,
                                                        'lock_status' : False
                                                        })
                            session_rec.write({'locked':False,'locked_by_user_id':False})
                            session.update({'locked': False,'locked_by_user_id': False})
            return sessions

    @api.multi
    def write(self,vals):
        res = super(lock_data,self).write(vals)
        res_users = self.env['res.users'].search([])
        notifications = []
        for user in res_users:
            notifications.append(((self._cr.dbname, 'lock.data', user.id), ('terminal_lock', self.read())))
            self.env['bus.bus'].sendmany(notifications)
        return res
 
    @api.model
    def create(self, vals):
        res = super(lock_data, self).create(vals)
        res_users = self.env['res.users'].search([])
        notifications = []
        for user in res_users:
            notifications.append(((self._cr.dbname, 'lock.data', user.id), ('terminal_lock', res.read())))
            self.env['bus.bus'].sendmany(notifications)
        return res

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: