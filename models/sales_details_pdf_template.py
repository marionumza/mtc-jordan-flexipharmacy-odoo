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

from odoo import models, api, _

class sales_details_pdf_template(models.AbstractModel):
    _name = 'report.flexipharmacy.sales_details_pdf_template'

    @api.model
    def get_report_values(self, docids, data=None):
        report = self.env['ir.actions.report']. \
            _get_report_from_name('flexipharmacy.sales_details_pdf_template')
        if data and data.get('form') and data.get('form').get('user_ids'):
            docids = self.env['wizard.sales.details'].browse(data['form']['user_ids'])
        return {'doc_ids': self.env['wizard.sales.details'].browse(data.get('ids')),
                'doc_model': report.model,
                'docs': self.env['wizard.sales.details'].browse(data['form']['user_ids']),
                'data': data,
                }

    # @api.multi
    # def render_html(self, docids, data=None):
    #     report_obj = self.env['report']
    #     report = report_obj._get_report_from_name('flexipharmacy.sales_details_pdf_template')
    #     docargs = {
    #         'doc_ids': self.env["wizard.sales.details"].browse(docids[0]),
    #         'doc_model': report.model,
    #         'docs': self,
    #         'data': data
    #     }
    #     return report_obj.render('flexipharmacy.sales_details_pdf_template', docargs)

class pos_sales_report_pdf_template(models.AbstractModel):
    _name = 'report.flexipharmacy.pos_sales_report_pdf_template'

    @api.model
    def get_report_values(self, docids, data=None):
        report = self.env['ir.actions.report'].\
            _get_report_from_name('flexipharmacy.pos_sales_report_pdf_template')
        if data and data.get('form') and data.get('form').get('session_ids'):
            docids = self.env['pos.session'].browse(data['form']['session_ids'])
        return {'doc_ids': self.env['wizard.pos.sale.report'].browse(data['ids']),
                'doc_model': report.model,
                'docs': self.env['pos.session'].browse(data['form']['session_ids']),
                'data': data,
                }


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: