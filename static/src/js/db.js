odoo.define('flexipharmacy.db', function (require) {
	"use strict";

	var DB = require('point_of_sale.DB');
	var core = require('web.core');
	var rpc = require('web.rpc');

	var _t = core._t;

	DB.include({
		init: function(options){
	        this._super.apply(this, arguments);
	        this.pay_button_by_id = {};
	        this.group_products = [];
        	this.order_write_date = null;
        	this.order_by_id = {};
        	this.line_by_id = {};
        	this.order_sorted = [];
        	this.order_search_string = "";
        	this.line_search_string = ""
        	this.product_search_string = "";
        	this.all_categories = [];
        	this.all_brands = [];
        	this.products_by_brand_id = {};
        	this.brands_search_list =[];
        	this.product_namelist = [];
        	this.dummy_product_ids = [];
        	this.product_write_date = '';
//        	Gift Card
        	this.card_products = [];
            this.card_write_date = null;
            this.card_by_id = {};
            this.card_sorted = [];
            this.card_search_string = "";
//            Voucher
            this.voucher_write_date = null;
            this.voucher_by_id = {};
            this.voucher_sorted = [];
            this.voucher_search_string = "";

            this.partners_name = [];
            this.partner_by_name = {};
            this.all_partners = [];
//          Stock Picking Data
            this.stock_picking_by_id = {};
            this.picking_sorted = [];
            this.picking_search_string = "";
            this.expire_categ_by_id = {};
            this.expire_categ_string = "";
            this.product_detail_search_string = "";
            this.product_expire_detail_by_id = {};
	    },
	    search_product: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            for(var i = 0; i < this.limit; i++){
                var r = re.exec(this.product_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_product_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        get_supplier_list: function(){
            var supplier_list = [];
            var params = {
                model: 'res.partner',
                method: 'search_read',
                domain: [['supplier','=','True']],
            }
            rpc.query(params, {async: false})
            .then(function(supplier){
                if(supplier && supplier[0]){
                     _.each(supplier, function(each_supplier){
                        supplier_list.push({
                            'id':each_supplier.id,
                            'value':each_supplier.name,
                            'label':each_supplier.name,
                        });
                     });
                }
            });
            return supplier_list;
        },
	    get_product_write_date: function(){
            return this.product_write_date || "1970-01-01 00:00:00";
        },
	    get_category_search_list: function(){
            var category_search_list = [];
            _.each(this.all_categories, function(category){
                category_search_list.push({
                    'id':category.id,
                    'value':category.name,
                    'label':category.name,
            	});
            });
            return category_search_list;
        },
	    get_all_categories : function() {
			return this.all_categories;
		},
	    add_categories: function(categories){
	    	this._super(categories);
	    	this.all_categories = categories;
	    },
	    add_brands: function(brands){
	    	var self = this;
	    	this.all_brands = brands;
	    	_.each(brands, function(brand){
	    		self.products_by_brand_id[brand.id] = [];
	    		self.brands_search_list.push({
                    'id':brand.id,
                    'value':brand.name,
                    'label':brand.name,
            	});
	    	});
	    },
	    get_barnds_search_list: function(){
            return this.brands_search_list;
        },
        get_products_by_brand_id: function(id){
        	return this.products_by_brand_id[id];
        },
	    add_quick_payment: function(quick_pays){
	    	var self = this;
	    	quick_pays.map(function(pay){
	    		self.pay_button_by_id[pay.id] = pay
	    	});
	    },
	    get_button_by_id: function(id){
	    	return this.pay_button_by_id[id]
	    },
	    get_product_namelist: function(){
	    	return this.product_namelist;
	    },
	    get_dummy_product_ids: function(){
	    	return this.dummy_product_ids;
	    },
	    add_products: function(products){
            var self = this;
            var new_write_date = '';
            this._super(products);
            var product;
            for(var i = 0, len = products.length; i < len; i++){
                product = products[i];
//                if(!product.is_packaging){
                if(!product.is_dummy_product){
                	this.product_namelist.push([product.id,product.display_name]);
                }else{
                	this.dummy_product_ids.push(product.id);
                }
                this.product_search_string += this._product_search_string(product);
                if (this.product_write_date && 
                    this.product_by_id[product.id] &&
                    new Date(this.product_write_date).getTime() + 1000 >=
                    new Date(product.write_date).getTime() ) {
                    continue;
                } else if ( new_write_date < product.write_date ) {
                    new_write_date  = product.write_date;
                }
                
                //Setup for product brands
                if(product.product_brand_id){
                	this.products_by_brand_id[product.product_brand_id[0]].push(product);
                }
	        }
	        this.product_write_date = new_write_date || this.product_write_date;
        },
		notification: function(type, message){
        	var types = ['success','warning','info', 'danger'];
        	if($.inArray(type.toLowerCase(),types) != -1){
        		$('div.span4').remove();
        		var newMessage = '';
        		message = _t(message);
        		switch(type){
        		case 'success' :
        			newMessage = '<i class="fa fa-check" aria-hidden="true"></i> '+message;
        			break;
        		case 'warning' :
        			newMessage = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> '+message;
        			break;
        		case 'info' :
        			newMessage = '<i class="fa fa-info" aria-hidden="true"></i> '+message;
        			break;
        		case 'danger' :
        			newMessage = '<i class="fa fa-ban" aria-hidden="true"></i> '+message;
        			break;
        		}
	        	$('body').append('<div class="span4 pull-right">' +
	                    '<div class="alert alert-'+type+' fade">' +
	                    newMessage+
	                   '</div>'+
	                 '</div>');
        	    $(".alert").removeClass("in").show();
        	    $(".alert").delay(200).addClass("in").fadeOut(5000);
        	}
        },
        add_orders: function(orders){
            var updated_count = 0;
            var new_write_date = '';
            for(var i = 0, len = orders.length; i < len; i++){
                var order = orders[i];
                if (    this.order_write_date && 
                        this.order_by_id[order.id] &&
                        new Date(this.order_write_date).getTime() + 1000 >=
                        new Date(order.write_date).getTime() ) {
                    continue;
                } else if ( new_write_date < order.write_date ) { 
                    new_write_date  = order.write_date;
                }
                if (!this.order_by_id[order.id]) {
                    this.order_sorted.push(order.id);
                }
                this.order_by_id[order.id] = order;
                updated_count += 1;
            }
            this.order_write_date = new_write_date || this.order_write_date;
            if (updated_count) {
                // If there were updates, we need to completely 
                this.order_search_string = "";
                for (var id in this.order_by_id) {
                    var order = this.order_by_id[id];
                    this.order_search_string += this._order_search_string(order);
                }
            }
            return updated_count;
        },
        _order_search_string: function(order){
            var str =  order.name;
            if(order.pos_reference){
                str += '|' + order.pos_reference;
            }
            if(order.partner_id.length > 0){
                str += '|' + order.partner_id[1];
            }
            str = '' + order.id + ':' + str.replace(':','') + '\n';
            return str;
        },
        get_order_write_date: function(){
            return this.order_write_date;
        },
        get_order_by_id: function(id){
            return this.order_by_id[id];
        },
        search_order: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.order_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_order_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        add_reserved_items: function(lines){
        	for(var i = 0, len = lines.length; i < len; i++){
        		var line = lines[i];
        		this.line_search_string += this._line_search_string(line);
        		this.line_by_id[line.id] = line
        	}
        },
        _line_search_string: function(line){
        	var str =  line.name;
        	if(line.product_id.length > 0){
                str += '|' + line.product_id[1];
            }
        	if(line.order_id.length > 0){
                str += '|' + line.order_id[1];
            }
        	str = '' + line.id + ':' + str.replace(':','') + '\n';
            return str;
        },
        search_item: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.line_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.line_by_id[id]);
                }else{
                    break;
                }
            }
            return results;
        },
        add_partners: function(partners){
			var self = this;
			for(var i = 0, len = partners.length; i < len; i++){
	            var partner = partners[i];
	            var old_partner = this.partner_by_id[partner.id];
	            if(partners && old_partner && partner.total_remaining_points !== old_partner.total_remaining_points){
	            	old_partner['total_remaining_points'] = partner.total_remaining_points;
	            }
	            if(partner.name){
        			self.partners_name.push(partner.name);
        			self.partner_by_name[partner.name] = partner;
        		}
			}
			if(partners.length > 0){
        		_.extend(this.all_partners, partners)
        	}
			return this._super(partners);
		},
		get_partners_name: function(){
        	return this.partners_name;
        },
        get_partner_by_name: function(name){
            if(this.partner_by_name[name]){
                return this.partner_by_name[name];
            }
            return undefined;
        },
        add_giftcard: function(gift_cards){
            var updated_count = 0;
            var new_write_date = '';
            for(var i = 0, len = gift_cards.length; i < len; i++){
                var gift_card = gift_cards[i];
                if (    this.card_write_date && 
                        this.card_by_id[gift_card.id] &&
                        new Date(this.card_write_date).getTime() + 1000 >=
                        new Date(gift_card.write_date).getTime() ) {
                    continue;
                } else if ( new_write_date < gift_card.write_date ) { 
                    new_write_date  = gift_card.write_date;
                }
                if (!this.card_by_id[gift_card.id]) {
                    this.card_sorted.push(gift_card.id);
                }
                this.card_by_id[gift_card.id] = gift_card;
                updated_count += 1;
            }
            this.card_write_date = new_write_date || this.card_write_date;
            if (updated_count) {
                // If there were updates, we need to completely 
                this.card_search_string = "";
                for (var id in this.card_by_id) {
                    var gift_card = this.card_by_id[id];
                    this.card_search_string += this._card_search_string(gift_card);
                }
            }
            return updated_count;
        },
        _card_search_string: function(gift_card){
            var str =  gift_card.card_no;
            if(gift_card.customer_id){
                str += '|' + gift_card.customer_id[1];
            }
            str = '' + gift_card.id + ':' + str.replace(':','') + '\n';
            return str;
        },
        get_card_write_date: function(){
            return this.card_write_date;
        },
        get_card_by_id: function(id){
            return this.card_by_id[id];
        },
        search_gift_card: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.card_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_card_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        add_gift_vouchers: function(gift_vouchers){
            var updated_count = 0;
            var new_write_date = '';
            for(var i = 0, len = gift_vouchers.length; i < len; i++){
                var gift_voucher = gift_vouchers[i];
                if (    this.voucher_write_date &&
                        this.voucher_by_id[gift_voucher.id] &&
                        new Date(this.voucher_write_date).getTime() + 1000 >=
                        new Date(gift_voucher.write_date).getTime() ) {
                    continue;
                } else if ( new_write_date < gift_voucher.write_date ) {
                    new_write_date  = gift_voucher.write_date;
                }
                if (!this.voucher_by_id[gift_voucher.id]) {
                    this.voucher_sorted.push(gift_voucher.id);
                }
                this.voucher_by_id[gift_voucher.id] = gift_voucher;
                updated_count += 1;
            }
            this.voucher_write_date = new_write_date || this.voucher_write_date;
            if (updated_count) {
                // If there were updates, we need to completely
                this.voucher_search_string = "";
                for (var id in this.voucher_by_id) {
                    var gift_voucher = this.voucher_by_id[id];
                    this.voucher_search_string += this._voucher_search_string(gift_voucher);
                }
            }
            return updated_count;
        },
        _voucher_search_string: function(gift_voucher){
            var str =  gift_voucher.voucher_name;
            if(gift_voucher.voucher_code){
                str += '|' + gift_voucher.voucher_code;
            }
            str = '' + gift_voucher.id + ':' + str.replace(':','') + '\n';
            return str;
        },
        get_voucher_write_date: function(){
            return this.voucher_write_date;
        },
        get_voucher_by_id: function(id){
            return this.voucher_by_id[id];
        },
        search_gift_vouchers: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.voucher_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_voucher_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
//        Stock Picking Screen Data
        add_stock_picking: function(stock_picking){
            var updated_count = 0;
            var new_write_date = '';
            for(var i = 0, len = stock_picking.length; i < len; i++){
                var stockpicking_data = stock_picking[i];
                if (    this.stock_picking_by_id[stockpicking_data.id]) {
                    continue;
                } else if ( new_write_date < stockpicking_data.write_date ) {
                    new_write_date  = stockpicking_data.write_date;
                }
                if (!this.stock_picking_by_id[stockpicking_data.id]) {
                    this.picking_sorted.push(stockpicking_data.id);
                }
                this.stock_picking_by_id[stockpicking_data.id] = stockpicking_data;
                updated_count += 1;
            }
            if (updated_count) {
                // If there were updates, we need to completely
                this.picking_search_string = "";
                for (var id in this.stock_picking_by_id) {
                    var stockpicking_data = this.stock_picking_by_id[id];
                    this.picking_search_string += this._picking_search_string(stockpicking_data);
                }
            }
            return updated_count;
        },
        _picking_search_string: function(stockpicking_data){
	    	var str =  stockpicking_data.name;
	        if(str){
	        	str = '' + stockpicking_data.id + ':' + str.replace(':','') + '\n';
		        return str;
	        }
	        return false
	    },
        get_picking_by_id: function(id){
            return this.stock_picking_by_id[id];
        },
        search_stock_picking: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.picking_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_picking_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        add_expire_categ: function(expire_categ){
            var updated_count = 0;
            for(var i = 0, len = expire_categ.length; i < len; i++){
                var expire_cat = expire_categ[i];
                this.expire_categ_by_id[expire_cat.categ_id] = expire_cat;
                updated_count += 1;
            }
            if (updated_count) {
            	this.expire_categ_string = "";
                for (var id in this.expire_categ_by_id) {
                    var expire_categ = this.expire_categ_by_id[id];
                    this.expire_categ_string += this._expire_categ_string(expire_categ);
                }
            }
            return updated_count;
        },
        _expire_categ_string: function(expire_categ){
        	var str =  expire_categ.categ_name;
            str = '' + expire_categ.categ_id + ':' + str.replace(':','') + '\n';
            return str;
        },
        search_exprire_categories: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.expire_categ_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_expire_categ_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        get_expire_categ_by_id: function(id){
        	return this.expire_categ_by_id[id];
        },
        add_detail_product_list: function(product_list){
            var updated_count = 0;
            for(var i = 0, len = product_list.length; i < len; i++){
                var product = product_list[i];
                this.product_expire_detail_by_id[product.product_id[0]] = product
                updated_count += 1;
            }
            if (updated_count) {
            	this.product_detail_search_string = "";
                for (var id in this.product_expire_detail_by_id) {
                    var product = this.product_expire_detail_by_id[id];
                    this.product_detail_search_string += this._product_detail_search_string(product);
                }
            }
            return updated_count;
        },
        _product_detail_search_string: function(product){
        	var str =  product.product_id[1];
        	if(product.lot_id){
                str += '|' + product.lot_id[1];
            }
            str = '' + product.product_id[0] + ':' + str.replace(':','') + '\n';
            return str;
        },
        get_product_expire_detail_by_id: function(id){
        	return this.product_expire_detail_by_id[id];
        },
        search_detail_product_list: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.product_detail_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_product_expire_detail_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
	});

});