odoo.define('flexipharmacy.chrome', function (require) {
"use strict";

	var chrome = require('point_of_sale.chrome');
	var gui = require('point_of_sale.gui');
	var PosBaseWidget = require('point_of_sale.BaseWidget');
	var core = require('web.core');
	var rpc = require('web.rpc');
	var ActionManager = require('web.ActionManager');
	var models = require('point_of_sale.models');
	var session = require('web.session');

	var _t = core._t;
	var QWeb = core.qweb;

	function start_lock_timer(time_interval,self){
        var $area = $(document),
        idleActions = [{
            milliseconds: time_interval * 100000,
            action: function () {
            	var params = {
    	    		model: 'pos.session',
    	    		method: 'write',
    	    		args: [self.pos.pos_session.id,{'is_lock_screen' : true}],
    	    	}
    	    	rpc.query(params, {async: false}).then(function(result){}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
                // $('.lock_button').css('background-color', 'rgb(233, 88, 95)');
                $('.freeze_screen').addClass("active_state");
                $(".unlock_button").fadeIn(2000);
                $('.unlock_button').show();
                $('.unlock_button').css('z-index',10000);
            }
        }];
        function lock (event, times, undefined) {
            var idleTimer = $area.data('idleTimer');
            if (times === undefined) times = 0;
            if (idleTimer) {
                clearTimeout($area.data('idleTimer'));
            }
            if (times < idleActions.length) {
                $area.data('idleTimer', setTimeout(function () {
                    idleActions[times].action();
                    lock(null, ++times);
                }, idleActions[times].milliseconds));
            } else {
                $area.off('mousemove click', lock);
            }
        };
        $area
            .data('idle', null)
            .on('mousemove click', lock);
        lock();
    }

	chrome.Chrome.include({
		events: {
            "click #product_sync": "product_sync",
            "click #pos_lock": "pos_lock",
			"click #messages_button": "messages_button",
			"click #close_draggable_panal": "close_draggable_panal",
			"click #delete_msg_history": "delete_msg_history"
        },
        product_sync: function(){
        	var self = this;
        	self.pos.load_new_products();
        	$('.prodcut_sync').toggleClass('rotate', 'rotate-reset');
		},
		build_widgets: function(){
			var self = this;
			this._super();
			self.slider_widget = new SliderWidget(this);
			self.pos_cart_widget = new PosCartCountWidget(this);
        	self.slider_widget.replace(this.$('.placeholder-SliderWidget'));
        	self.pos_cart_widget.replace(this.$('.placeholder-PosCartCountWidget'));
//			if(self.pos.config.login_screen){
			self.gui.set_startup_screen('login');
			self.gui.show_screen('login');
//			}
//			if(self.pos.pos_session.is_lock_screen){
//    			$('.order-button.lock_button').click();
//    		}
		},
		pos_lock: function(){
			var self = this;
			self.pos.session_by_id = {};
			var domain = [['state','=', 'opened'],['id','!=',self.pos.pos_session.id]];
         	var params = {
	    		model: 'pos.session',
	    		method: 'search_read',
	    		domain: domain,
	    	}
	    	rpc.query(params, {async: false}).then(function(sessions){
	    		if(sessions && sessions.length > 0){
	    			_.each(sessions,function(session){
	    				self.pos.session_by_id[session.id] = session;
	    			});
	    			self.pos.gui.show_popup('terminal_list',{'sessions':sessions});
	    		} else{
	    			self.pos.db.notification('danger',_t('Active sessions not found!'));
	    		}
	    	}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
		},
		messages_button: function(){
			var self = this;
			if($('#draggablePanelList').css('display') == 'none'){
				$('#draggablePanelList').animate({
    	            height: 'toggle'
    	            }, 200, function() {
    	        });
				self.render_message_list(self.pos.message_list);
				$('.panel-body').css({'height':'auto','max-height':'242px','min-height':'45px','overflow':'auto'});
				$('.head_data').html(_t("Message"));
				$('.panel-body').html("Message-Box Empty");
			}else{
				$('#draggablePanelList').animate({
    	            height: 'toggle'
    	            }, 200, function() {
    	        });
			}
		},
		close_draggable_panal:function(){
			$('#draggablePanelList').animate({
	            height: 'toggle'
	            }, 200, function() {
	        });
		},
		delete_msg_history: function(){
			var self = this;
			var params = {
	    		model: 'message.terminal',
	    		method: 'delete_user_message',
	    		args: [self.pos.pos_session.id],
	    	}
	    	rpc.query(params, {async: false}).then(function(result){
	    		if(result){
	    			self.pos.message_list = []
		    		self.render_message_list(self.pos.message_list)
	    		}
	    	}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
		},
		render_message_list: function(message_list){
	    	var self = this;
	        if(message_list && message_list[0]){
	        	var contents = $('.message-panel-body');
		        contents.html("");
		        var temp_str = "";
		        for(var i=0;i<message_list.length;i++){
		            var message = message_list[i];
	                var messageline_html = QWeb.render('MessageLine',{widget: this, message:message_list[i]});
		            temp_str += messageline_html;
		        }
		        contents.html(temp_str)
		        $('.message-panel-body').scrollTop($('.message-panel-body')[0].scrollHeight);
		        $('#message_icon').css("color", "gray");
	        } else{
	        	var contents = $('.message-panel-body');
		        contents.html("");
	        }
	    },
	    user_icon_url(id){
			return '/web/image?model=res.users&id='+id+'&field=image_small';
		},
	});

    var SliderWidget = PosBaseWidget.extend({
        template: 'SliderWidget',
        init: function(parent, options){
            var self = this;
            this._super(parent,options);
            self.click_username = function(){
				self.pos.get_order().destroy();
				self.gui.show_screen('login');
//                self.gui.select_user({
//                    'security':     true,
//                    'current_user': self.pos.get_cashier(),
//                    'title':      _t('Change Cashier'),
//                }).then(function(user){
//                    self.pos.set_cashier(user);
//                    self.renderElement();
//                });
            };
            self.sidebar_button_click = function(){
            	if(self.gui.get_current_screen() !== "receipt"){
            		$(this).parent().removeClass('oe_hidden');
                	$(this).parent().toggleClass("toggled");
    				$(this).find('i').toggleClass('fa fa-chevron-left fa fa-chevron-right');
            	}
        	};
        	self.open_product_screen = function(){
                self.gui.show_screen('product-screen');
                self.close_sidebar();
        	};
        	self.open_expiry_deshboard = function(){
        		self.gui.show_screen('product_expiry_deshboard');
        		self.close_sidebar();
        	},
        	self.open_sales_deshboard = function(){
        		self.gui.show_screen('pos_dashboard_graph_view');
        		self.close_sidebar();
        	},
        	self.out_of_stock_detail = function(){
                self.gui.show_screen('product-out-of-stock');
        		self.close_sidebar();
        	},
        	self.gift_card_screen = function(){
        		self.close_sidebar();
        		self.gui.show_screen('giftcardlistscreen');
        	};
        	self.discard_product_screen = function(){
        		self.close_sidebar();
        		self.gui.show_screen('stockpickinglistscreen');
        	},
        	self.gift_voucher_screen = function(){
        		self.close_sidebar();
        		self.gui.show_screen('voucherlistscreen');
        	};
        	self.open_order_screen = function(){
        		self.gui.show_screen('orderlist');
        		self.close_sidebar();
        	};
        	self.print_lastorder = function(){
        		self.close_sidebar();
        		if(self.pos.get('pos_order_list').length > 0){
					var last_order_id = Math.max.apply(Math,self.pos.get('pos_order_list').map(function(o){return o.id;}))
					var result = self.pos.db.get_order_by_id(last_order_id);
	                var selectedOrder = self.pos.get_order();
	                var currentOrderLines = selectedOrder.get_orderlines();
	                if(currentOrderLines.length > 0) {
	                	selectedOrder.set_order_id('');
	                    for (var i=0; i <= currentOrderLines.length + 1; i++) {
	                    	_.each(currentOrderLines,function(item) {
	                            selectedOrder.remove_orderline(item);
	                        });
	                    }
	                    selectedOrder.set_client(null);
	                }
	                if (result && result.lines.length > 0) {
	                    partner = null;
	                    if (result.partner_id && result.partner_id[0]) {
	                        var partner = self.pos.db.get_partner_by_id(result.partner_id[0])
	                    }
	                    selectedOrder.set_amount_paid(result.amount_paid);
	                    selectedOrder.set_amount_return(Math.abs(result.amount_return));
	                    selectedOrder.set_amount_tax(result.amount_tax);
	                    selectedOrder.set_amount_total(result.amount_total);
	                    selectedOrder.set_company_id(result.company_id[1]);
	                    selectedOrder.set_date_order(result.date_order);
	                    selectedOrder.set_client(partner);
	                    selectedOrder.set_pos_reference(result.pos_reference);
	                    selectedOrder.set_user_name(result.user_id && result.user_id[1]);
	                    selectedOrder.set_order_note(result.note);
	                    var statement_ids = [];
	                    if (result.statement_ids) {
	                    	var params = {
                	    		model: 'account.bank.statement.line',
                	    		method: 'search_read',
                	    		domain: [['id', 'in', result.statement_ids]],
                	    	}
                	    	rpc.query(params, {async: false}).then(function(st){
                	    		if (st) {
                            		_.each(st, function(st_res){
                                    	var pymnt = {};
                                    	pymnt['amount']= st_res.amount;
                                        pymnt['journal']= st_res.journal_id[1];
                                        statement_ids.push(pymnt);
                            		});
                                }
                	    	}).fail(function(){
                            	self.pos.db.notification('danger',"Connection lost");
                            });
	                        selectedOrder.set_journal(statement_ids);
	                    }
	                    var params = {
            	    		model: 'pos.order.line',
            	    		method: 'search_read',
            	    		domain: [['id', 'in', result.lines]],
            	    	}
            	    	rpc.query(params, {async: false}).then(function(lines){
            	    		if (lines) {
	                        	_.each(lines, function(line){
	                                var product = self.pos.db.get_product_by_id(Number(line.product_id[0]));
	                                var _line = new models.Orderline({}, {pos: self.pos, order: selectedOrder, product: product});
	                                _line.set_discount(line.discount);
	                                _line.set_quantity(line.qty);
	                                _line.set_unit_price(line.price_unit)
	                                _line.set_line_note(line.line_note);
	                                _line.set_bag_color(line.is_bag);
	                                _line.set_deliver_info(line.deliver);
	                                if(line && line.is_delivery_product){
	                                	_line.set_delivery_charges_color(true);
	                                	_line.set_delivery_charges_flag(true);
	                                }
	                                selectedOrder.add_orderline(_line);
	                        	});
	                        }
            	    	}).fail(function(){
                        	self.pos.db.notification('danger',"Connection lost");
                        });
	                    if(self.pos.config.iface_print_via_proxy){
                            var receipt = selectedOrder.export_for_printing();
                            var env = {
                                    receipt: receipt,
                                    widget: self,
                                    pos: self.pos,
                                    order: self.pos.get_order(),
                                    paymentlines: self.pos.get_order().get_paymentlines()
                                }
                                self.pos.proxy.print_receipt(QWeb.render('XmlReceipt',env));
                            self.pos.get('selectedOrder').destroy();    //finish order and go back to scan screen
                        }else{
                        	self.gui.show_screen('receipt');
                        }
	                }
				} else {
					self.pos.db.notification('danger',_t("No order to print."));
				}
        	};
        	self.pos_graph = function(){
        		self.gui.show_screen('graph_view');
        		self.close_sidebar();
        	};
        	self.x_report = function(){
        		var pos_session_id = [self.pos.pos_session.id];
        		self.pos.chrome.do_action('flexipharmacy.pos_x_report',{additional_context:{
                    active_ids:pos_session_id,
                }}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
        	};
        	self.print_audit_report = function(){
        		self.close_sidebar();
        		self.gui.show_popup('report_popup');
        	};
        	self.print_credit_stmt = function(){
        		self.close_sidebar();
                if(self.pos.get_order().get_client() && self.pos.get_order().get_client().name){
                	self.gui.show_popup('print_credit_detail_popup');
                    var order = self.pos.get_order();
                    order.set_ledger_click(true);
                }else{
                    self.gui.show_screen('clientlist');
                }
        	};
        	self.payment_summary_report = function(){
        		self.close_sidebar();
        		self.gui.show_popup('payment_summary_report_wizard');
        	};
        	self.product_summary_report = function(){
        		self.close_sidebar();
        		self.gui.show_popup('product_summary_report_wizard');
        	};
        	self.order_summary_report = function(){
        		self.close_sidebar();
        		self.gui.show_popup('order_summary_popup');
        	};
        	self.today_sale_report = function(){
        		self.close_sidebar();
        		var str_payment = '';
        		var params = {
    	    		model: 'pos.session',
    	    		method: 'get_session_report',
    	    		args: [],
    	    	}
    	    	rpc.query(params, {async: false}).then(function(result){
		            if(result['error']){
		            	self.pos.db.notification('danger',result['error']);
		            }
		            if(result['payment_lst']){
						var temp = [] ;
						for(var i=0;i<result['payment_lst'].length;i++){
							if(result['payment_lst'][i].session_name){
								if(jQuery.inArray(result['payment_lst'][i].session_name,temp) != -1){
									str_payment+="<tr><td style='font-size: 14px;padding: 8px;'>"+result['payment_lst'][i].journals+"</td>" +
									"<td style='font-size: 14px;padding: 8px;'>"+self.format_currency(result['payment_lst'][i].total.toFixed(2))+"</td>" +
								"</tr>";
								}else{
									str_payment+="<tr><td style='font-size:14px;padding: 8px;' colspan='2'>"+result['payment_lst'][i].session_name+"</td></tr>"+
									"<td style='font-size: 14px;padding: 8px;'>"+result['payment_lst'][i].journals+"</td>" +
									"<td style='font-size: 14px;padding: 8px;'>"+self.format_currency(result['payment_lst'][i].total.toFixed(2))+"</td>" +
								"</tr>";
								temp.push(result['payment_lst'][i].session_name);
								}
							}
						}
					}
		            self.gui.show_popup('pos_today_sale',{result:result,str_payment:str_payment});
		    	}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
        	};
        },
        close_sidebar: function(){
        	$("#wrapper").addClass('toggled');
            $('#wrapper').find('i').toggleClass('fa fa-chevron-left fa fa-chevron-right');
        },
        renderElement: function(){
        	var self = this;
        	self._super();
        	self.el.querySelector('#side_username').addEventListener('click', self.click_username);
        	self.el.querySelector('#slidemenubtn').addEventListener('click', self.sidebar_button_click);
        	self.el.querySelector('a#product-screen').addEventListener('click', self.open_product_screen);
        	if(self.pos.config.product_expiry_report && self.pos.get_cashier().access_product_expiry_report){
        		self.el.querySelector('li.expiry_deshboard').addEventListener('click', self.open_expiry_deshboard);
        	}
        	if(self.pos.config.pos_dashboard && self.pos.get_cashier().access_pos_dashboard){
        		
        		self.el.querySelector('li.sales_deshboard').addEventListener('click', self.open_sales_deshboard);
        	}
        	if(self.pos.config.out_of_stock_detail){
        	    self.el.querySelector('a#out_of_stock').addEventListener('click', self.out_of_stock_detail);
        	}
        	if(self.pos.config.enable_gift_card && self.pos.get_cashier().access_gift_card){
        		self.el.querySelector('a#gift_card_screen').addEventListener('click', self.gift_card_screen);
        	}
        	if(self.pos.config.discard_product && self.pos.get_cashier().discard_product){
        		self.el.querySelector('a#discard_product_screen').addEventListener('click', self.discard_product_screen);
        	}
        	if(self.pos.config.enable_gift_voucher && self.pos.get_cashier().access_gift_voucher){
        		self.el.querySelector('a#gift_voucher_screen').addEventListener('click', self.gift_voucher_screen);
        	}
        	if(self.pos.config.enable_reorder && self.pos.get_cashier().access_reorder){
        		self.el.querySelector('a#order-screen').addEventListener('click', self.open_order_screen);
        	}
        	if(self.pos.config.enable_print_last_receipt && self.pos.get_cashier().access_print_last_receipt){
        		self.el.querySelector('a#print_lastorder').addEventListener('click', self.print_lastorder);
        	}
        	if(self.el.querySelector('li.pos-graph')){
        		self.el.querySelector('li.pos-graph').addEventListener('click', self.pos_graph);
        	}
        	if(self.el.querySelector('li.x-report')){
        		self.el.querySelector('li.x-report').addEventListener('click', self.x_report);
        	}
        	if(self.el.querySelector('li.today_sale_report')){
        		self.el.querySelector('li.today_sale_report').addEventListener('click', self.today_sale_report);
        	}
        	if(self.el.querySelector('li.payment_summary_report')){
        		self.el.querySelector('li.payment_summary_report').addEventListener('click', self.payment_summary_report);
        	}
        	if(self.el.querySelector('li.product_summary_report')){
        		self.el.querySelector('li.product_summary_report').addEventListener('click', self.product_summary_report);
        	}
        	if(self.el.querySelector('li.order_summary_report')){
        		self.el.querySelector('li.order_summary_report').addEventListener('click', self.order_summary_report);
        	}
        	if(self.el.querySelector('li.print_audit_report')){
        		self.el.querySelector('li.print_audit_report').addEventListener('click', self.print_audit_report);
            }
            if(self.el.querySelector('li.print_credit_stmt')){
        		self.el.querySelector('li.print_credit_stmt').addEventListener('click', self.print_credit_stmt);
        	}
        	$('.main_slider-ul').click(function() {
        	    $(this).find('ul.content-list-ul').slideToggle();
//        	    $(this).find('i').toggleClass('fa fa-chevron-down fa fa-chevron-right');
        	    /*if($('#toggle_image').hasClass('right')){
        	    	$('#toggle_image').removeClass('right');
        	    	$('#toggle_image').attr('src','/flexipharmacy/static/src/img/icons/angle-down.svg')
        	    }else{
        	    	$('#toggle_image').addClass('right');
        	    	$('#toggle_image').attr('src','/flexipharmacy/static/src/img/icons/angle-right.png')
        	    }*/
        	});
        },
	});

    var PosCartCountWidget = PosBaseWidget.extend({
        template: 'PosCartCountWidget',
        init: function(parent, options){
            var self = this;
            this._super(parent,options);
            self.show_cart = function(){
            	var order = self.pos.get_order();
            	if(order.is_empty()) {
            		return;
            	}
            	if(self.gui.get_current_screen() != 'products'){
            		var html_data = $('.order-scroller').html();
                	$('.show-left-cart').html('').append(html_data);
                	$('.show-left-cart').toggle("slide");
            	}
            };
        },
        renderElement: function(){
        	var self = this;
        	self._super();
        	$(".pos-cart-info").delegate( "#pos-cart", "click",self.show_cart);
        },
    });

    chrome.HeaderButtonWidget.include({
		renderElement: function(){
	        var self = this;
	        this._super();
	        if(this.action){
	            this.$el.click(function(){
	            	self.gui.show_popup('POS_session_config');
	            });
	        }
	    },
	});

    chrome.OrderSelectorWidget.include({
    	start: function(){
            this._super();
            var customer_display = this.pos.config.customer_display;
            if(this.pos.get_order()){
            	if(customer_display){
            		this.pos.get_order().mirror_image_data();
            	}
            }
    	},
//    	deleteorder_click_handler: function(event, $el) {
//            var self  = this;
//            $('.show-left-cart').hide();
//            if(self.gui.get_current_screen() == "receipt"){
//            	return
//            }
//            this._super(event, $el);
//    	},
    	deleteorder_click_handler: function(event, $el) {
            var self  = this;
            $('.show-left-cart').hide();
            if(self.gui.get_current_screen() == "receipt"){
            	return
            }
            var order = this.pos.get_order();
            var customer_display = this.pos.config.customer_display;
            if (!order) {
                return;
            } else if ( !order.is_empty() ){
                this.gui.show_popup('confirm',{
                    'title': _t('Destroy Current Order ?'),
                    'body': _t('You will lose any data associated with the current order'),
                    confirm: function(){
                        self.pos.delete_current_order();
                        if(customer_display){
                        	self.pos.get_order().mirror_image_data();
                        }
                    },
                });
            } else {
                this.pos.delete_current_order();
                if(customer_display){
                	self.pos.get_order().mirror_image_data();
                }
            }
        },

    	renderElement: function(){
            var self = this;
            this._super();
            var customer_display = this.pos.config.customer_display;
            this.$('.order-button.select-order').click(function(event){
            	if(self.pos.get_order() && customer_display){
            		self.pos.get_order().mirror_image_data();
            	}
            });
            this.$('.neworder-button').click(function(event){
            	if(self.pos.get_order() && customer_display){
            		self.pos.get_order().mirror_image_data();
            	}
            });
            this.$('.deleteorder-button').click(function(event){
            	if(self.pos.get_order() && customer_display){
            		self.pos.get_order().mirror_image_data();
            	}
            });
            if(this.pos.config.enable_automatic_lock && self.pos.get_cashier().access_pos_lock){
                var time_interval = this.pos.config.time_interval || 3;
                start_lock_timer(time_interval,self);
            }
            // Click on Manual Lock button
            $('.order-button.lock_button').click(function(){
            	self.gui.show_popup('lock_popup');
//            	var current_screen = self.pos.gui.get_current_screen();
//            	var user = self.pos.get_cashier();
//                self.pos.set_locked_user(user.login);
//                if(current_screen){
//                	self.pos.set_locked_screen(current_screen);
//                }
//            	var params = {
//    	    		model: 'pos.session',
//    	    		method: 'write',
//    	    		args: [self.pos.pos_session.id,{'is_lock_screen' : true}],
//    	    	}
//    	    	rpc.query(params, {async: false}).then(function(result){})
//                $('.lock_button').css('background-color', 'rgb(233, 88, 95)');
//                $('.freeze_screen').addClass("active_state");
//                $(".unlock_button").fadeIn(2000);
//                $('.unlock_button').show();
//                $('.unlock_button').css('z-index',10000);
            });
            // Click on Unlock button
            $('.unlock_button').click(function(){
                // $('.lock_button').css('background-color', 'rgb(233, 88, 95)');
                $('.freeze_screen').removeClass("active_state");
                $('.unlock_button').hide();
                $('.unlock_button').css('z-index',0);
                self.gui.show_screen('login');
                $('.get-input').focus();
            });
        },
    });

});