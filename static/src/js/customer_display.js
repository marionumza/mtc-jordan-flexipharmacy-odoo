odoo.define('flexipharmacy.customer_display', function (require) {
"use strict";

	var Widget = require('web.Widget');
	var session = require('web.session');
	var rpc = require('web.rpc');
	var core = require('web.core');
	var bus = require('bus.bus').bus;
	var utils = require('web.utils');
	var field_utils = require('web.field_utils');
	var round_di = utils.round_decimals;

	var _t = core._t;
	var QWeb = core.qweb;

	var CustomerDisplayWidget = Widget.extend({
		init:function(parent,options){
			this._super(parent);
			this.company_id = session.company_id;
			this.config_id = Number(odoo.config_id);
			this.image_interval = false;
			this.advertise_data = false;
			this.load_config();
			this.load_customer_display_data();
			this.load_currency();
		},
		load_config: function(){
			var self = this;
			if(this.config_id){
				var params = {
	        		model: 'customer.display',
	        		method: 'load_config',
	        		args: [self.config_id],
	        	}
	        	rpc.query(params, {async: false})
	            .then(function(pos_config){
	            	if(pos_config && pos_config[0]){
	            		self.image_interval = pos_config[0].image_interval || 0;
	            	}
	            });
			}
		},
		load_customer_display_data: function(){
			var self = this;
			var params = {
        		model: 'customer.display',
        		method: 'load_customer_display_data',
        		args: [self.config_id],
        	}
        	rpc.query(params, {async: false})
            .then(function(advertise_data){
            	if(advertise_data && advertise_data[0]){
            		self.advertise_data = advertise_data;
            	}
            });
		},
		load_currency: function(){
	    	var self = this;
	    	var params = {
        		model: 'customer.display',
        		method: 'load_currency',
        		args: [self.company_id],
        	}
        	rpc.query(params, {async: false})
            .then(function(currency){
            	if(currency && currency[0]){
            		self.currency = currency[0];
            		if (self.currency.rounding > 0 && self.currency.rounding < 1) {
                        self.currency.decimals = Math.ceil(Math.log(1.0 / self.currency.rounding) / Math.log(10));
                    } else {
                        self.currency.decimals = 0;
                    }
            	}
            });
	    },
		format_currency: function(amount,precision){
	    	var self = this;
	        var currency = (self && self.currency) ? self.currency : {symbol:'$', position: 'after', rounding: 0.01, decimals: 2};
	        amount = this.format_currency_no_symbol(amount,precision);
	        if (currency.position === 'after') {
	            return amount + ' ' + (currency.symbol || '');
	        } else {
	            return (currency.symbol || '') + ' ' + amount;
	        }
	    },
	    format_currency_no_symbol: function(amount, precision) {
	    	var self = this;
	        var currency = (self && self.currency) ? self.currency : {symbol:'$', position: 'after', rounding: 0.01, decimals: 2};
	        var decimals = currency.decimals;
	        if (typeof amount === 'number') {
	            amount = round_di(amount,decimals).toFixed(decimals);
	            amount = field_utils.format.float(round_di(amount, decimals), {digits: [69, decimals]});
	        }
	        return amount;
	    },
	});

	var CustomerDisplayScreen = CustomerDisplayWidget.extend({
	    template: 'CustomerDisplayScreen',
	    init: function() {
	    	var self = this;
	        this._super(arguments[0],{});
	        this.customer_name = 'Unknown';
	        self.company_logo = window.location.origin+"/web/binary/company_logo?db=pos_customer_screen_v11&company="+self.company_id;
	    },
	    start: function(){
	    	this._super();
	    	var self = this;
//	    	Left Panel
    		this.left_panel = new LeftPanelWidget(this, {});
	        this.left_panel.replace(this.$('.placeholder-LeftPanelWidget'));

//	        Right Panel
    		this.right_panel = new RightPanelWidget(this, {});
	        this.right_panel.replace(this.$('.placeholder-RightPanelWidget'));

	        bus.update_option('customer.display', session.uid);
	    	bus.on('notification', self, self._onNotification);
	    	bus.start_polling();

	    	setTimeout(function(){
	    		self.render_customer();
	    	},100);

	    },
	    _onNotification: function(notifications){
	    	var self = this;
	    	for (var notif of notifications) {
	    		if(notif[1][0] == "customer_display_data"){
	    			var user_id = notif[1][1].user_id;
	    			var cart_data = notif[1][1].cart_data;
	    			var customer_name = notif[1][1].customer_name;
	    			self.customer_name = customer_name;
	    			self.render_customer();
	                self.left_panel.update_cart_data(cart_data);
	                var order_total = notif[1][1].order_total;
	                var change_amount = notif[1][1].change_amount;
	                var payment_info = notif[1][1].payment_info;
	                self.right_panel.update_data(order_total, change_amount, payment_info);
	                self.scroll_down();
	    		}
	    	}
	    },
	    scroll_down: function(){
	    	var scrl_height = 0;
            $(".order-scroller").prop('scrollHeight');
            scrl_height = $(".order-scroller").prop('scrollHeight');
            if(scrl_height){
        	    $(document).find(".order-scroller").scrollTop(scrl_height);
            } else{
        	    $(document).find(".order-scroller").scrollTop($(document).find(".order-scroller").prop('scrollHeight'));
            }
	    },
	    render_customer: function(){
	    	var self = this;
	    	var el_customer_name = QWeb.render('CustomerName',{
				customer_name:self.customer_name,
            });
            $('.client_name').html(el_customer_name);
	    },
	});

	var LeftPanelWidget = CustomerDisplayWidget.extend({
		template: 'LeftPanelWidget',
		init: function(){
			var self = this;
	        this._super(arguments[0],{});
	        this.cart_data = false;
		},
		replace: function($target){
			this.renderElement();
			var target = $target[0];
			target.parentNode.replaceChild(this.el,target);
		},
		renderElement: function(){
			var self = this;
			self.origin = session.origin;
			var el_str = QWeb.render(this.template, {
				widget: this, 
				cart_data:this.cart_data,
			});
			var el_node = document.createElement('div');
			el_node.innerHTML = el_str;
			el_node = el_node.childNodes[1];
			if(this.el && this.el.parentNode){
				this.el.parentNode.replaceChild(el_node,this.el);
			}
			this.el = el_node;
		},
		update_cart_data: function(cart_data){
			this.cart_data = cart_data
			this.renderElement();
		},
	});

	var RightPanelWidget = CustomerDisplayWidget.extend({
		template: 'RightPanelWidget',
		init: function(){
			var self = this;
	        this._super(arguments[0],{});
	        self.order_amount = 0;
            self.change_amount = 0;
            self.payment_info = [];
		},
		replace: function($target){
			this.renderElement();
			var target = $target[0];
			target.parentNode.replaceChild(this.el,target);
		},
		update_data: function(order_total, change_amount, payment_info){
			var self = this;
			self.order_amount = order_total;
            self.change_amount = change_amount;
            self.payment_info = payment_info;
            var payment_details = QWeb.render('Payment-Details',{ 
                widget:  self,
            });
            $('.pos-payment_info_details').html(payment_details);
            var paymentline_details = QWeb.render('Paymentlines-Details',{ 
                widget:  self,
            });
            $('.paymentline-details').html(paymentline_details);
		},
		renderElement: function(){
			var self = this;
			self.origin = session.origin;
			var el_str = QWeb.render(this.template, {
				widget: this,
				order_amount: self.order_amount,
				change_amount: self.change_amount,
				payment_info:self.payment_info,
			});
			var el_node = document.createElement('div');
			el_node.innerHTML = el_str;
			el_node = el_node.childNodes[1];
			if(this.el && this.el.parentNode){
				this.el.parentNode.replaceChild(el_node,this.el);
			}
			this.el = el_node;
			setTimeout(function(){
				self.start_slider();
			},100)
		},
		start_slider: function(){
			var time = this.image_interval * 1000;
			var slideCount = $('#slider ul li').length;
			var slideWidth = $('#slider ul li').width();
			var slideHeight = $('#slider ul li').height();
			var sliderUlWidth = slideCount * slideWidth;
			$('#slider').css({ width: slideWidth, height: slideHeight });
			$('#slider ul').css({ width: sliderUlWidth, marginLeft: - slideWidth });
		    $('#slider ul li:last-child').prependTo('#slider ul');
		    function moveLeft() {
		        $('#slider ul').animate({
		            left: + slideWidth
		        }, 200, function () {
		            $('#slider ul li:last-child').prependTo('#slider ul');
		            $('#slider ul').css('left', '');
		        });
		    };
		    function moveRight() {
		        $('#slider ul').animate({
		            left: - slideWidth
		        }, 200, function () {
		            $('#slider ul li:first-child').appendTo('#slider ul');
		            $('#slider ul').css('left', '');
		        });
		    };
		    $('a.control_prev').click(function (e) {
		    	e.stopImmediatePropagation();
		        moveLeft();
		    });
		    $('a.control_next').click(function (e) {
		    	e.stopImmediatePropagation();
		        moveRight();
		    });
		    setInterval(function(){
		    	$('a.control_next').trigger('click');
		    }, time);
		},
	});

	core.action_registry.add('customer_display.ui', CustomerDisplayScreen);
});