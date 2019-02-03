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
{
    'name': 'POS Pharmacy',
    'version': '1.0',
    'author': 'Acespritech Solutions Pvt. Ltd.',
    'summary': 'POS Pharmacy with Responsive Design (Community)',
    'description': "POS Pharmacy with Responsive Design (Community)",
    'category': 'Point Of Sale',
    'website': 'http://www.acespritech.com',
    'depends': ['base', 'point_of_sale', 'sale_management', 'barcodes', 'product_expiry','purchase'],
    'price': 170.00,
    'currency': 'EUR',
    'images': [
        'static/description/main_screenshot.png',
    ],
    'data': [
        'data/data.xml',
        'data/reservation_data.xml',
        'data/pos_cache_data.xml',
        'views/flexipharmacy.xml',
        'views/res_config_settings.xml',
        'views/generate_product_ean13_view.xml',
        'views/point_of_sale.xml',
        'views/pos_config.xml',
        'views/res_config_settings.xml',
        'views/sale_view.xml',
        'views/pos_shop_view.xml',
        'views/stock.xml',
        'views/pos_cache_views.xml',
        'views/product_view.xml',
        'views/product_brand_view.xml',
        'views/account_view.xml',
        'views/res_company_view.xml',
        'views/loyalty_config_view.xml',
        'views/loyalty_view.xml',
        'views/res_partner_view.xml',
        'views/gift_card.xml',
        'views/voucher_view.xml',
        'views/voucher_code_sequence.xml',
        'views/res_users_view.xml',
        'views/pos_sales_report_template.xml',
        'views/pos_sales_report_pdf_template.xml',
        'views/sales_details_pdf_template.xml',
        'views/sales_details_template.xml',
        'views/front_sales_report_pdf_template.xml',
        'views/front_sales_thermal_report_template.xml',
        'views/pos_report.xml',
        'reports.xml',
        'views/front_inventory_session_pdf_report_template.xml',
        'views/front_inventory_session_thermal_report_template.xml',
        'views/front_inventory_location_pdf_report_template.xml',
        'views/front_inventory_location_thermal_report_template.xml',
        'wizard/wizard_pos_sale_report_view.xml',
        'wizard/wizard_sales_details_view.xml',
        'wizard/wizard_pos_x_report.xml',
        'views/pos_promotion_view.xml',
        'views/stock_production_lot_view.xml',
        'views/wallet_management_view.xml',
        'views/cash_inout_menu.xml',
        'views/customer_display.xml',
        'views/product_product_view.xml',
        'views/dashboard.xml',
        'security/ir.model.access.csv',
    ],
    'qweb': ['static/src/xml/*.xml'],
    'installable': True,
    'application': True,
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
