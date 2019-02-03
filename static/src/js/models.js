odoo.define('flexipharmacy.models', function (require) {
	"use strict";

	var models = require('point_of_sale.models');
	var core = require('web.core');
	var rpc = require('web.rpc');
	var _t = core._t;
	var utils = require('web.utils');
	var bus = require('bus.bus').bus;

	var round_pr = utils.round_precision;
	var QWeb = core.qweb;

	models.load_fields("res.users", ['image_small','login','company_ids','access_ereceipt','access_quick_cash_payment',
	                                 'access_order_note','access_product_note','access_pos_return','access_reorder',
	                                 'access_draft_order','access_rounding','access_bag_charges','access_delivery_charges',
	                                 'access_pos_lock','access_keyboard_shortcut','access_product_sync','access_display_warehouse_qty',
	                                 'access_pos_graph','access_x_report','access_pos_loyalty',
	                                 'access_today_sale_report','access_money_in_out','access_gift_card','access_gift_voucher',
	                                 'access_print_last_receipt','access_pos_promotion','lock_terminal','delete_msg_log','access_show_qty',
	                                 'access_print_valid_days','access_card_charges','access_wallet','access_print_cash_statement',
	                                 'discard_product','based_on','can_give_discount', 'discount_limit','login_with_pos_screen',
	                                 'access_pos_dashboard','access_product_expiry_report','shop_ids']);
	models.load_fields("res.partner", ['prefer_ereceipt','remaining_loyalty_points',
	                                   'remaining_credit_amount','property_account_receivable_id','parent_id',
	                                   'remaining_loyalty_amount', 'loyalty_points_earned',
	                                   'total_remaining_points','remaining_wallet_amount','credit_limit',
	                                   'remaining_credit_limit','remaining_debit_amount','debit_limit']);
	models.load_fields("product.product", ['qty_available','type','is_packaging','product_brand_id','write_date','loyalty_point','is_dummy_product']);
	models.load_fields("product.category", ['complete_name']);
	models.load_fields('pos.session',['is_lock_screen','current_cashier_id','locked','locked_by_user_id','opening_balance','shop_id']);
	models.load_fields("account.journal", ['pos_journal_id','shortcut_key','jr_use_for','apply_charges','fees_amount','fees_type','optional']);
    models.load_fields("res.company", ['payment_total','pos_price', 'pos_quantity', 'pos_discount', 'pos_search', 'pos_next']);
    models.load_fields("pos.category", ['loyalty_point','return_valid_days']);
    models.load_fields("pos.order", ['is_delivery'], ['picking_id']);

	models.PosModel.prototype.models.push({
        model:  'quick.cash.payment',
        fields: ['display_name','name_amt'],
        loaded: function(self,quick_pays){
            self.quick_pays = quick_pays;
            self.db.add_quick_payment(quick_pays);
        },
    },{
        model: 'stock.location',
        fields: [],
//        ids:    function(self){ return [self.config.stock_location_id[0]]; },
        domain: function(self) { return [['usage', '=', 'internal'],['company_id','=',self.config.company_id[0]]]; },
        loaded: function(self, locations){
        	if(locations && locations[0]){
        		self.location_ids = locations;
        		self.locations_by_id = {};
        		_.each(locations,function(loc){
        			self.locations_by_id[loc.id] = loc;
        		});
        	}
        },
    },{
        model:  'pos.shop',
        fields: [],
        domain: function(self){return[['company_id','=',self.company.id]]},
        loaded: function(self,pos_shop){
            self.shop_by_id = {};
            _.each(pos_shop, function(shop) {
                self.shop_by_id[shop.id] = shop;
            });
        },
    },{
        model: 'product.brand',
        fields: [],
        loaded: function(self, brands){
        	if(brands){
        		self.db.add_brands(brands)
        	}
        },
    },{
        model:  'aspl.gift.card.type',
        fields: ['name'],
        loaded: function(self,card_type){
            self.card_type = card_type;
        },
    },{
        model:  'pos.promotion',
        fields: [],
        domain: function(self){
        	var current_date = moment(new Date()).locale("en").format("YYYY-MM-DD");
        	return [['from_date','<=',current_date],['to_date','>=',current_date],['active','=',true]];
        },
        loaded: function(self, pos_promotions){
            self.pos_promotions = pos_promotions;
        },
    },{
    	model:  'pos.conditions',
        fields: [],
        loaded: function(self,pos_conditions){
            self.pos_conditions = pos_conditions;
        },
    },{
    	model:  'get.discount',
        fields: [],
        loaded: function(self,pos_get_discount){
            self.pos_get_discount = pos_get_discount;
        },
    },{
    	model:  'quantity.discount',
        fields: [],
        loaded: function(self,pos_get_qty_discount){
            self.pos_get_qty_discount = pos_get_qty_discount;
        },
    },{
    	model:  'quantity.discount.amt',
        fields: [],
        loaded: function(self,pos_qty_discount_amt){
            self.pos_qty_discount_amt = pos_qty_discount_amt;
        },
    },{
    	model:  'discount.multi.products',
        fields: [],
        loaded: function(self,pos_discount_multi_prods){
            self.pos_discount_multi_prods = pos_discount_multi_prods;
        },
    },{
    	model:  'discount.multi.categories',
        fields: [],
        loaded: function(self,pos_discount_multi_categ){
            self.pos_discount_multi_categ = pos_discount_multi_categ;
        },
    },{
    	model:  'discount.above.price',
        fields: [],
        loaded: function(self,pos_discount_above_price){
            self.pos_discount_above_price = pos_discount_above_price;
        },
    },{
        model:  'message.terminal',
        fields: [],
        domain: function(self) { return [['message_session_id', '=', self.pos_session.id]]; },
        loaded: function(self,message_list){
            self.message_list = message_list;
        },
    });

	function decimalAdjust(value){
	    var split_value = value.toFixed(2).split('.');
	    //convert string value to integer
	    for(var i=0; i < split_value.length; i++){
	        split_value[i] = parseInt(split_value[i]);
	    }
	    var reminder_value = split_value[1] % 10;
	    var division_value = parseInt(split_value[1] / 10);
	    var rounding_value;
	    var nagative_sign = false;
	    if(split_value[0] == 0 && value < 0){
	        nagative_sign = true;
	    }
	    if(_.contains(_.range(0,5), reminder_value)){
	        rounding_value = eval(split_value[0].toString() + '.' + division_value.toString() + '0' )
	    }else if(_.contains(_.range(5,10), reminder_value)){
	        rounding_value = eval(split_value[0].toString() + '.' + division_value.toString() + '5' )
	    }
	    if(nagative_sign){
	        return -rounding_value;
	    }else{
	        return rounding_value;
	    }
	}

	var posmodel_super = models.PosModel.prototype;
	models.PosModel = models.PosModel.extend({
		initialize: function(session, attributes) {
            var self = this;
			this.product_list = [];
            this.load_background = false;
            this.product_fields = ['qty_available','write_date'];
            this.product_domain = [];
            this.product_context = {display_default_code: false };
            this.all_pos_session = [];
			this.all_locations = [];
			this.credit_amount = 0.00;
            posmodel_super.initialize.call(this, session, attributes);
            this.set({
                'pos_order_list':[],
            });
            bus.update_option('lock.data', session.uid);
	    	bus.on('notification', self, self._onNotification);
	    	bus.start_polling();
		},
		is_product_loading: function () {
			return this.load_background;
		},
		get_customer_due: function(partner){
        	var self = this;
        	var domain = [];
            var amount_due = 0;
        	domain.push(['partner_id', '=', partner.id],['reserved','=',false]);
        	var params = {
        		model: 'pos.order',
        		method: 'search_read',
        		domain: domain,
        	}
        	rpc.query(params, {async: false})
            .then(function(orders){
                if(orders){
                    var filtered_orders = orders.filter(function(o){return (o.amount_total - o.amount_paid) > 0})
                    for(var i = 0; i < filtered_orders.length; i++){
                        amount_due = amount_due + filtered_orders[i].amount_due;
                    }
                }
            })
            return amount_due;
        },
		load_new_products: function(){
            var self = this;
            var def  = new $.Deferred();
            var fields = this.product_fields;
            var pos_domain = this.product_domain;
            var prod_domain = [['write_date','>',self.db.get_product_write_date()]]; 
            prod_domain = prod_domain.concat(pos_domain);
            var context = { pricelist: self.default_pricelist.id, display_default_code: false };
            rpc.query({
                    model: 'product.product',
                    method: 'search_read',
                    domain: prod_domain,
                    fields: fields,
                    context: context,
                }, {
                    timeout: 3000,
                    shadow: true,
                    async: false,
                }).then(function(products){
                	var setup_prd = _.map(products, function (product) {
	                    product.categ = _.findWhere(self.product_categories, {'id': product.categ_id[0]});
	                    return new models.Product({}, product);
	                })
                	var prod_obj = self.gui.screen_instances.products.product_list_widget;
                	var current_pricelist = prod_obj._get_active_pricelist();
	                _.map(setup_prd,function(product){
	                	if(current_pricelist){
	                		prod_obj.product_cache.clear_node(product.id+','+current_pricelist.id);
	            			prod_obj.render_product(product);
	                	}
	                	prod_obj.renderElement();
            		});
                	if (self.db.add_products(setup_prd)) {
                        def.resolve();
                    } else {
                        def.reject();
                    }
                }, function(type,err){def.reject(); });
            return def;
        },
        load_new_partners: function(){
	        var self = this;
	        var def  = new $.Deferred();
	        var fields = _.find(this.models,function(model){ return model.model === 'res.partner'; }).fields;
	        var domain = [['customer','=',true],['write_date','>',this.db.get_partner_write_date()]];
	        rpc.query({
	                model: 'res.partner',
	                method: 'search_read',
	                args: [domain, fields],
	            }, {
	                timeout: 3000,
	                shadow: true,
	            })
	            .then(function(partners){
	                if (self.db.add_partners(partners)) {   // check if the partners we got were real updates
	                	var partner = false;
	                	if(self.get_client()){
	                		partner = self.get_client();
	                	}else{
	                		partner =  partners[0];
	                	}
	                	if(partner){
	                		self.gui.screen_instances.clientlist.display_client_details('show',partner,0);
	                	}
	                    def.resolve();
	                } else {
	                    def.reject();
	                }
	            }, function(type,err){ def.reject(); });
	        return def;
	    },
	    load_server_data: function () {
	        var self = this;
	        var product_index = _.findIndex(this.models, function (model) {
	            return model.model === "product.product";
	        });
	        var product_model = this.models[product_index];
	        self.user_by_id = {};
	        self.product_fields = product_model.fields;
	        self.product_domain = product_model.domain;
	        if (product_index !== -1) {
	            this.models.splice(product_index, 1);
	        }
	        return posmodel_super.load_server_data.apply(this, arguments).then(function () {
	            var session_params = {
    				model: 'pos.session',
    				method: 'search_read',
    				domain: [['state','=','opened']],
    				fields: ['id','name','config_id'],
    				orderBy: [{ name: 'id', asc: true}],
    			}
    			rpc.query(session_params, {async: false})
    			.then(function(sessions){
    				if(sessions && sessions[0]){
    					self.all_pos_session = sessions;
    				}
    			});
	        	var stock_location_params = {
    				model: 'stock.location',
    				method: 'search_read',
    				domain: [['usage','=','internal'],['company_id','=',self.company.id]],
    				fields: ['id','name','company_id','complete_name'],
    			}
    			rpc.query(stock_location_params, {async: false})
    			.then(function(locations){
    				if(locations && locations[0]){
    					self.all_locations = locations;
    				}
    			});

	        	self.set_lock_status(self.pos_session.locked);
	        	self.start_timer();
				_.each(self.users, function(user){
					self.user_by_id[user.id] = user;
				});
				var params = {
						model: 'lock.data',
						method: 'search_read',
						domain: [['session_id', '=', self.pos_session.id]],
					}
					rpc.query(params, {async: false}).then(function(lock_data){
						if(lock_data && lock_data.length > 0){
							self.set_lock_data(lock_data[0]);
						}
		            }).fail(function(){
	                	self.db.notification('danger',"Connection lost");
	                });
	        	if(self.config.enable_reorder){
					var from_date = moment().locale("en").format('YYYY-MM-DD')
					if(self.config.last_days){
						from_date = moment().subtract(self.config.last_days, 'days').locale("en").format('YYYY-MM-DD');
					}
					self.domain_as_args = [['state','not in',['cancel']], ['create_date', '>=', from_date]];
					var params = {
						model: 'pos.order',
						method: 'ac_pos_search_read',
						args: [{'domain': self.domain_as_args}],
					}
					rpc.query(params, {async: false}).then(function(orders){
		                if(orders.length > 0){
		                	self.db.add_orders(orders);
		                    self.set({'pos_order_list' : orders});
		                }
	
		            }).fail(function(){
	                	self.db.notification('danger',"Connection lost");
	                });
				}
//	        	var params = {
//					model: 'loyalty.config.settings',
//					method: 'search_read',
//					orderBy: [{ name: 'id', asc: false}],
//					limit: 1,
//					fields: ['points_based_on', 'minimum_purchase', 'point_calculation', 'points', 'to_amount']
//				}
	        	var params = {
					model: 'loyalty.config.settings',
					method: 'load_loyalty_config_settings',
				}
				rpc.query(params)
		    	.then(function(loyalty_config){
		    		if(loyalty_config && loyalty_config[0]){
		    			self.loyalty_config = loyalty_config[0];
		    		}
		    	}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
	        	var params_ir_config = {
					model: 'pos.order',
					method: 'load_ir_config_parameter',
				}
	        	rpc.query(params_ir_config)
		    	.then(function(system_parameters){
	    			if(system_parameters){
	    				self.system_parameters = system_parameters;
	    			}
		    	});
	        	var gift_card_params = {
                	model: 'aspl.gift.card',
                	method: 'search_read',
                	domain: [['is_active', '=', true]],
                }
                rpc.query(gift_card_params, {async: false}).then(function(gift_cards){
                    self.db.add_giftcard(gift_cards);
                    self.set({'gift_card_order_list' : gift_cards});
                }).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
	        	var voucher_params = {
                	model: 'aspl.gift.voucher',
                	method: 'search_read',
                	args: [],
                }
                rpc.query(voucher_params, {async: false}).then(function(gift_vouchers){
                    self.db.add_gift_vouchers(gift_vouchers);
                    self.set({'gift_voucher_list' : gift_vouchers});
                }).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
            	var from_cache = false;
            	if(self.config.multi_shop_id && self.config.multi_shop_id[0] && self.pos_session.shop_id && self.pos_session.shop_id[0]){
            		self.load_background = true;
            		return
            	} else{
	            	var check_cache = rpc.query({
	                    model: 'pos.cache',
	                    method: 'search',
	                    args: [[['config_id', '=',self.pos_session.config_id[0]]]],
	                });
	            	return check_cache.then(function(res){
	            		if(res && res[0]){
	        	        	var records = rpc.query({
	        	                    model: 'pos.config',
	        	                    method: 'get_products_from_cache',
	        	                    args: [self.pos_session.config_id[0], self.product_fields, self.product_domain],
	        	                }).fail(function(){
	        	                	self.db.notification('danger',"Connection lost");
	        	                });
	        	            self.chrome.loading_message(_t('Loading') + ' product.product', 1);
	        	            return records.then(function (products) {
	        	                self.db.add_products(_.map(products, function (product) {
	        	                    product.categ = _.findWhere(self.product_categories, {'id': product.categ_id[0]});
	        	                    return new models.Product({}, product);
	        	                }));
	        	            });
	            		} else {
	            			self.load_background = true;
	            			return
	            		}
	            	});
            	}
	        });
	    },
	    get_cashier: function(){
	        // reset the cashier to the current user if session is new
//	        if (this.db.load('pos_session_id') !== this.pos_session.id) {
//	            this.set_cashier(this.user);
//	        }
	        return this.db.get_cashier() || this.get('cashier') || this.user;
	    },
	    set_cashier: function(user){
			var self = this;
			posmodel_super.set_cashier.apply(this, arguments);
			var params = {
	    		model: 'pos.session',
	    		method: 'write',
	    		args: [self.pos_session.id,{'current_cashier_id':user.id}],
	    	}
	    	rpc.query(params, {async: false}).then(function(result){
				if(user.lock_terminal){
					var button_lock = QWeb.render('LockIconChrome',{widget: self});
					$('.lock_widget').html(button_lock);
				} else{
					$('.lock_widget').html("");
				}
    		}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
		},
		_onNotification: function(notifications){
			var self = this;
			for (var notif of notifications) {
	    		if(notif[1][0] == "terminal_lock"){
    				if(notif[1][1]){
    					if(notif[1][1][0]){
    						if(notif[1][1][0].session_id[0] == self.pos_session.id){
    							self.set_lock_status(notif[1][1][0].lock_status);
    							self.set_lock_data(notif[1][1][0]);
    						}
    					}
    				}
	    		} else if(notif[1][0] == "terminal_message"){
	    			if(notif[1][1] && notif[1][1][0]){
            			if(self.pos_session.id == notif[1][1][0].message_session_id[0]){
            				var message_index = _.findIndex(self.message_list, function (message) {
                                return message.id === notif[1][1][0].id;
                            });
                			if(message_index == -1){
                				self.message_list.push(notif[1][1][0]);
                				self.chrome.render_message_list(self.message_list);
                				$('#message_icon').css("color", "#5EB937");
                				self.db.notification('info',notif[1][1][0].sender_user[1]+' has sent new message.');
                			}
            			}
            		}
	    		}
	    	}
		},
		start_timer: function(){
        	var self = this;
        	setInterval(function() {
                if(self.get_lock_status()){
                	if(self.get_lock_data() && self.get_lock_data().session_id[0] == self.pos_session.id){
                		$('#block_session_freeze_screen').addClass("active_state_freeze_screen");
                        $('.lock_screen_button').fadeIn(2000);
                        $('span.lock_screen_button').show();
                        $('#msg_lock').show();
                        $('#msg_lock').text("Your session has been blocked by "+self.get_lock_data().locked_by_user_id[1]);
                	} else{
                		$('#block_session_freeze_screen').removeClass("active_state_freeze_screen");
                        $('span.lock_screen_button').hide();
                        $('#msg_lock').hide();
                        $('#msg_lock').text('');
                	}
                } else{
                	$('#block_session_freeze_screen').removeClass("active_state_freeze_screen");
                    $('span.lock_screen_button').hide();
                    $('#msg_lock').hide();
                    $('#msg_lock').text('');
                }
            },2 * 1000);
        },
        set_lock_status:function(status){
        	this.set('pos_block_status',status)
        },
        get_lock_status: function(){
        	return this.get('pos_block_status')
        },
        set_lock_data: function(lock_data){
        	this.set('pos_block_data',lock_data);
        },
        get_lock_data: function(){
        	return this.get('pos_block_data');
        },
        set_title_detail_expire_screen:function(title){
    		this.set('screen_title',title)
    	},
    	get_title_detail_expire_screen: function(){
    		return this.get('screen_title');
    	},
//        send: function() {
//            var self = this;
//            $.ajax({
//                type: "GET",
//	            url: '/web/dataset/get_update',
//	            async:false,
//	            data:{
//	            	'check_session_id' :self.pos_session.id,
//	            	'current_cashier' : self.get_cashier().id,
//	            	'cashier_name' : self.get_cashier().name
//	            },
//	            success: function(res) {
//	            	if(res){
//	            		var result = JSON.parse(res);
//	            		if(result && result[0]){
//	            			if(result[0].session_id[0] == self.pos_session.id){
//	            				self.pos_session.locked = result[0].lock_status;
//	            			}
//			            	if(result[0].lock_status){
//			            		var lock_by_user_name = "";
//			            		_.each(self.users,function(user){
//			            			if(user.id == result[0].locked_by_user_id[0]){
//			            				 lock_by_user_name = user.name
//			            			}
//			            		});
//			            		$('#block_session_freeze_screen').addClass("active_state_freeze_screen");
//			                    $('.lock_screen_button').fadeIn(2000);
//			                    $('span.lock_screen_button').show();
//			                    $('#msg_lock').show();
//			                    $('#msg_lock').text("Your session has been blocked by "+lock_by_user_name);
//			            	} else{
//			            		$('#block_session_freeze_screen').removeClass("active_state_freeze_screen");
//			                    $('span.lock_screen_button').hide();
//			                    $('#msg_lock').hide();
//			                    $('#msg_lock').text('');
//			            	}
//	            		}
//	            	}
//	            },
//	            error: function() {
//	                console.log('calling failed.',self);
//	            },
//            });
//        },
//        message: function(){
//			var self = this;
//			var flag_message_list_done = true;
//            $.ajax({
//                type: "GET",
//	            url: '/web/dataset/get_update',
//	            async:false,
//	            data:{
//	            	'get_message' : true,
//	            	'check_session_id' :self.pos_session.id,
//	            },
//	            success: function(res) {
//	            	if(res){
//	            		var result = JSON.parse(res);
//	            		if(result && result[0]){
//	            			var message_index = _.findIndex(self.message_list, function (message) {
//	                            return message.id === result[0].id;
//	                        });
//	            			if(message_index == -1){
//	            				self.message_list.push(result[0]);
//	            				self.chrome.render_message_list(self.message_list);
//	            				$('#message_icon').css("color", "#5EB937");
//	            				self.db.notification('info',result[0].sender_user[1]+' has sent new message.');
//	            			}
//	            		}
//	            	}
//	            },
//            });
//		},
	    _save_to_server: function (orders, options) {
			var self = this;
			return posmodel_super._save_to_server.apply(this, arguments)
			.done(function(server_ids){
				_.each(orders, function(order) {
	        		var lines = order.data.lines;
	        		_.each(lines, function(line){
	        		    if(line[2].location_id === self.config.stock_location_id[0]){
                            var product_id = line[2].product_id;
                            var product_qty = line[2].qty;
                            var product = self.db.get_product_by_id(product_id);
                            var remain_qty = product.qty_available - product_qty;
                            product.qty_available = remain_qty;
                            self.gui.screen_instances.products.product_list_widget.product_cache.clear_node(product.id)
                            var prod_obj = self.gui.screen_instances.products.product_list_widget;
                            var current_pricelist = prod_obj._get_active_pricelist();
                            if(current_pricelist){
                                prod_obj.product_cache.clear_node(product.id+','+current_pricelist.id);
                                prod_obj.render_product(product);
                            }
                            prod_obj.renderElement();
	        			}
	        		});
	        	});
	        	if(server_ids && server_ids.length > 0 && self.config.enable_reorder){
					var domain_list;
					if(self.config.multi_shop_id && self.config.multi_shop_id[0]){
//						domain_list.push(['shop_id','=',self.config.multi_shop_id[0]])
						domain_list = ['|',['shop_id','=',false],['shop_id','=',self.config.multi_shop_id[0]],['id','in',server_ids]]
					} else{
						domain_list = [['id','in',server_ids],['store_id','=',false]]
					}
					var params = {
						model: 'pos.order',
						method: 'ac_pos_search_read',
						args: [{'domain': domain_list}],
					}
					rpc.query(params, {async: false}).then(function(orders){
		                if(orders.length > 0){
		                	orders = orders[0];
		                    var exist_order = _.findWhere(self.get('pos_order_list'), {'pos_reference': orders.pos_reference})
		                    if(exist_order){
		                    	_.extend(exist_order, orders);
		                    } else {
		                    	self.get('pos_order_list').push(orders);
		                    }
		                    var new_orders = _.sortBy(self.get('pos_order_list'), 'id').reverse();
		                    self.db.add_orders(new_orders);
		                    self.set({ 'pos_order_list' : new_orders });
		                }
		            }).fail(function(){
	                	self.db.notification('danger',"Connection lost");
	                });
				}
			});
		},
		// change the current order
	    set_order: function(order){
	    	this.set({ selectedOrder: order });
	    	var selectedOrder = this.get_order();
	    	if(selectedOrder && selectedOrder.get_reservation_mode()){
	    		selectedOrder.change_mode("reservation_mode");
	    	} else {
	    		selectedOrder.change_mode("sale");
	    	}
	    },
		add_new_order: function(){
			$('#open_calendar').css({'background-color':''});
			$('#delivery_mode').removeClass('deliver_on');
			return posmodel_super.add_new_order.apply(this);
		},
		set_locked_user: function(locked_user){
			this.locked_user = locked_user;
		},
		get_locked_user: function(){
			return this.locked_user;
		},
		set_locked_screen: function(locked_screen){
			this.locked_screen = locked_screen;
		},
		get_locked_screen: function(){
			return this.locked_screen;
		},
		set_login_from: function(login_from){
			this.login_from = login_from;
		},
		get_login_from: function(){
			return this.login_from;
		},
	});
	
	var _super_Order = models.Order.prototype;
	models.Order = models.Order.extend({
		initialize: function(attributes,options){
			if(options.json){
				options.json.lines = [];
				options.json.statement_ids = [];
			}
			this.serial_list = [];
    		this.print_serial = true;
			var res = _super_Order.initialize.apply(this, arguments);
            this.set({
                ret_o_id:       null,
                ret_o_ref:      null,
                sale_mode:      true,
                missing_mode:   false,
                loyalty_redeemed_point: 0.00,
        		loyalty_earned_point: 0.00,
        		type_for_wallet: false,
                change_amount_for_wallet: false,
                use_wallet: false,
        		used_amount_from_wallet: false,
        		// Credit Management
                paying_due: false,
                paying_order: false,
                type_for_credit: false,
                change_amount_for_credit: false,
                use_credit: false,
                is_delivery: false,
                credit_detail: [],
                customer_credit:false,
        		// Reservation
        		reservation_mode: false,
        		reserve_delivery_date: false,
                draft_order: false,
                paying_due: false,
                fresh_order: false,
            });
            $("div#sale_mode").addClass('selected-menu');
            $("div#order_return").removeClass('selected-menu');
            $("div#reservation_mode").removeClass('selected-menu');
            this.receipt_type = 'receipt';  // 'receipt' || 'invoice'
            this.temporary = options.temporary || false;
            this.rounding_status = false;
            this.giftcard = [];
            this.redeem =[];
            this.recharge=[];
            this.date=[];
            this.voucher = [];
            this.remaining_redeemption = false;
            return this;
        },
//        Cash In/Out
        set_money_inout_details: function(money_inout_details){
            this.money_inout_details = money_inout_details;
        },
        get_money_inout_details: function(){
            return this.money_inout_details;
        },
        set_cash_register: function(result){
            this.result = result;
        },
        get_cash_register: function(){
            return this.result;
        },
        set_statement_cashier: function(user_id){
            this.user_id = user_id;
        },
        get_statement_cashier: function(){
            return this.user_id;
        },
        //Out of Stock
        set_receipt_mode: function(receipt_mode) {
            this.receipt_mode = receipt_mode;
        },
        get_receipt_mode: function() {
            return this.receipt_mode;
        },
        set_product_vals :function(product_vals) {
            this.product_vals = product_vals;
        },
        get_product_vals: function() {
            return this.product_vals;
        },
        set_location_vals: function(select_location) {
            this.select_location = select_location;
        },
        get_location_vals: function() {
            return this.select_location;
        },
        set_list_products: function(list_products){
            this.list_products = list_products;
        },
        get_list_products: function(){
            return this.list_products;
        },
        //Reservation
        set_reservation_mode: function(mode){
            this.set('reservation_mode', mode)
        },
        get_reservation_mode: function(){
            return this.get('reservation_mode');
        },
        set_reserve_delivery_date: function(val){
            this.set('reserve_delivery_date', val)
        },
        get_reserve_delivery_date: function(){
            return this.get('reserve_delivery_date');
        },
        set_cancel_order: function(val){
            this.set('cancel_order', val)
        },
        get_cancel_order: function(){
            return this.get('cancel_order');
        },
        set_paying_due: function(val){
            this.set('paying_due', val)
        },
        get_paying_due: function(){
            return this.get('paying_due');
        },
        set_draft_order: function(val) {
            this.set('draft_order', val);
        },
        get_draft_order: function() {
            return this.get('draft_order');
        },
        set_cancellation_charges: function(val) {
            this.set('cancellation_charges', val);
        },
        get_cancellation_charges: function() {
            return this.get('cancellation_charges');
        },
        set_refund_amount: function(refund_amount) {
            this.set('refund_amount', refund_amount);
        },
        get_refund_amount: function() {
            return this.get('refund_amount');
        },
        set_fresh_order: function(fresh_order) {
            this.set('fresh_order', fresh_order);
        },
        get_fresh_order: function() {
            return this.get('fresh_order');
        },
        set_partial_pay: function(partial_pay) {
            this.set('partial_pay', partial_pay);
        },
        get_partial_pay: function() {
            return this.get('partial_pay');
        },
        // end reservation
        is_sale_product: function(product){
        	var self = this;
        	var delivery_product_id = self.pos.config.delivery_product_id[0] || false;
	    	if(product.is_packaging){
	    		return false;
	    	} else if(product.id == delivery_product_id){
	    		return false;
	    	}else {
	    		return true;
	    	}
	    },
        empty_cart: function(){
	    	var self = this;
       	 	var currentOrderLines = this.get_orderlines();
       	 	var lines_ids = []
    	 	if(!this.is_empty()) {
    	 		_.each(currentOrderLines,function(item) {
    	 			lines_ids.push(item.id);
				});
    	 		_.each(lines_ids,function(id) {
    	 			self.remove_orderline(self.get_orderline(id));
				});
    	 	}
	    },
        change_mode: function(mode){
        	if(mode == 'sale'){
        		//Enable mode
        		this.set_sale_mode(true);
        		$("div#sale_mode").addClass('selected-menu');
        		
        		//disable other modes
        		this.set_missing_mode(false);
        		$("div#order_return").removeClass('selected-menu');
        		this.set_reservation_mode(false);
        		$("div#reservation_mode").removeClass('selected-menu');
        	} else if( mode == 'missing') {
        		//Enable mode
        		this.set_missing_mode(true);
        		$("div#order_return").addClass('selected-menu');
        		
        		//disable other modes
        		this.set_sale_mode(false);
        		$("div#sale_mode").removeClass('selected-menu');
        		this.set_reservation_mode(false);
        		$("div#reservation_mode").removeClass('selected-menu');
        	} else if(mode == 'reservation_mode'){
        		//Enable mode
        		this.set_reservation_mode(true);
        		$("div#reservation_mode").addClass('selected-menu');
        		
        		//disable other modes
        		this.set_sale_mode(false);
        		$("div#sale_mode").removeClass('selected-menu');
        		this.set_missing_mode(false);
        		$("div#order_return").removeClass('selected-menu');
        	}
        },
    	set_pricelist: function (pricelist) {
            var self = this;
            this.pricelist = pricelist;
            if(pricelist != self.pos.default_pricelist && self.pos.config.use_pricelist){
    			_.each(this.get_orderlines(), function (line) {
    	            line.set_original_price(line.get_display_price());
    	        });
    		}
            var lines_to_recompute = _.filter(this.get_orderlines(), function (line) {
                return ! line.price_manually_set;
            });
            _.each(lines_to_recompute, function (line) {
            	if(!line.get_is_rule_applied()){
            		line.set_unit_price(line.product.get_price(self.pricelist, line.get_quantity()));
                    self.fix_tax_included_price(line);
            	}
            });
            this.trigger('change');
        },
        set_sale_mode: function(sale_mode) {
            this.set('sale_mode', sale_mode);
        },
        get_sale_mode: function() {
            return this.get('sale_mode');
        },
        set_missing_mode: function(missing_mode) {
            this.set('missing_mode', missing_mode);
        },
        get_missing_mode: function() {
            return this.get('missing_mode');
        },
        generate_unique_id: function() {
        	var timestamp = new Date().getTime(); 
            return Number(timestamp.toString().slice(-10));
        },
        generateUniqueId_barcode: function() {
            return new Date().getTime();
        },
        set_ereceipt_mail: function(ereceipt_mail) {
            this.set('ereceipt_mail', ereceipt_mail);
        },
        get_ereceipt_mail: function() {
            return this.get('ereceipt_mail');
        },
        set_prefer_ereceipt: function(prefer_ereceipt) {
            this.set('prefer_ereceipt', prefer_ereceipt);
        },
        get_prefer_ereceipt: function() {
            return this.get('prefer_ereceipt');
        },
        set_order_note: function(order_note) {
            this.order_note = order_note;
        },
        get_order_note: function() {
            return this.order_note;
        },
        set_ret_o_id: function(ret_o_id) {
            this.set('ret_o_id', ret_o_id)
        },
        get_ret_o_id: function(){
            return this.get('ret_o_id');
        },
        set_ret_o_ref: function(ret_o_ref) {
            this.set('ret_o_ref', ret_o_ref)
        },
        get_ret_o_ref: function(){
            return this.get('ret_o_ref');
        },
//        Payment Summary
        set_sales_summary_mode: function(sales_summary_mode) {
            this.sales_summary_mode = sales_summary_mode;
        },
        get_sales_summary_mode: function() {
            return this.sales_summary_mode;
        },
        set_sales_summary_vals :function(sales_summary_vals) {
            this.sales_summary_vals = sales_summary_vals;
        },
        get_sales_summary_vals: function() {
            return this.sales_summary_vals;
        },
// Order Summary
        set_receipt: function(custom_receipt) {
        	this.custom_receipt = custom_receipt;	
        },
        get_receipt: function() {
        	return this.custom_receipt;
        },
        set_order_list: function(order_list) {
        	this.order_list = order_list;
        },
        get_order_list: function() {
        	return this.order_list;
        },

        cart_product_qnty: function(product_id,flag){
	    	var self = this;
	    	var res = 0;
	    	var order = self.pos.get_order();
	    	var orderlines = order.get_orderlines();
	    	if (flag){
	    		_.each(orderlines, function(orderline){
					if(orderline.product.id == product_id){
						res += orderline.quantity
					}
	    		});
				return res;
	    	} else {
	    		_.each(orderlines, function(orderline){
					if(orderline.product.id == product_id && !orderline.selected){
						res += orderline.quantity
					}
	    		});
	    		return res;
	    	}
	    },
	    get_product_qty: function(product_id){
	    	var self = this;
    		var order = self.pos.get_order();
			var lines = order.get_new_order_lines();
			var new_lines = [];
			var line_ids = [];
			var qty = 0;
			_.each(lines, function(line){
				if(line && line.get_quantity() > 0 && !line.get_is_rule_applied()){
					if(line.product.id == product_id){
						qty += line.get_quantity();
						line_ids.push(line.id);
					}
				}
			});
			var result = {
				'total_qty':Number(qty),
				'line_ids':line_ids,
			}
			return result;
	    },
        add_product: function(product, options){
        	var self = this;
        	if(this.get_missing_mode()){
        		return _super_Order.add_product.call(this, product, {quantity:-1});
        	} else if(options && options.force_allow){
    			_super_Order.add_product.call(this, product, options);
        	} else {
        		var product_quaty = self.cart_product_qnty(product.id,true);
    			if(self.pos.config.restrict_order && self.pos.get_cashier().access_show_qty && product.type != "service"){
    	        	if(self.pos.config.prod_qty_limit){
    	        		var remain = product.qty_available-self.pos.config.prod_qty_limit
    	        		if(product_quaty>=remain){
    	        			if(self.pos.config.custom_msg){
    	        				self.pos.db.notification('warning',self.pos.config.custom_msg);
    		        		} else{
    		        			self.pos.db.notification('warning', _t('Product Out of Stock'));
    		        		}
    	    				return
    		        	}
    	        	}
            		if(product_quaty>=product.qty_available && !self.pos.config.prod_qty_limit){
    	        		if(self.pos.config.custom_msg){
    	        			self.pos.db.notification('warning',self.pos.config.custom_msg);
    	        		} else{
    	        			self.pos.db.notification('warning', _t('Product Out of Stock'));
    	        		}
    	    			return
    	        	}
    	        }
    			_super_Order.add_product.call(this, product, options);
        	}
        	var selected_line = this.get_selected_orderline();
        	if(this.get_delivery() && $('#delivery_mode').hasClass('deliver_on')){
        		selected_line.set_deliver_info(true);
			}
        	if(selected_line && this.pricelist != this.pos.default_pricelist && this.pos.config.use_pricelist){
    			selected_line.set_original_price(product.get_price(this.pos.default_pricelist, selected_line.get_quantity()))
    		}
        	self.remove_promotion();
        	self.apply_promotion();
        	if(self.pos.config.customer_display){
        		self.mirror_image_data();
        	}
        },
        set_client: function(client){
        	_super_Order.set_client.apply(this, arguments);
    		this.mirror_image_data();
        },
        mirror_image_data:function(){
            var self = this;
            var client_name = false;
            var order_total = self.get_total_with_tax();
            var change_amount = self.get_change();
            var payment_info = [];
            var paymentlines = self.paymentlines.models;
            if(paymentlines && paymentlines[0]){
            	paymentlines.map(function(paymentline){
            		payment_info.push({
            			'name':paymentline.name,
            			'amount':paymentline.amount,
            		});
            	});
            }
            if(self.get_client()){
            	client_name = self.get_client().name;
            }
            var vals = {
            	'cart_data':$('.order-container').html(),
            	'client_name':client_name,
            	'order_total':order_total,
            	'change_amount':change_amount,
            	'payment_info':payment_info,
            }
            rpc.query({
                model: 'customer.display',
                method: 'broadcast_data',
                args: [vals],
            })
            .then(function(result) {});
        },
        remove_promotion: function(){
	    	var self = this;
    		var order = self.pos.get_order();
			var lines = order.get_orderlines();
			var selected_line = order.get_selected_orderline() || false;
			var cashier = self.pos.get_cashier();
			if(selected_line){
				if(selected_line.get_child_line_id()){
					var child_line = order.get_orderline(selected_line.get_child_line_id());
					if(child_line){
						selected_line.set_child_line_id(false);
						selected_line.set_is_rule_applied(false);
						order.remove_orderline(child_line);
					}
				}else if(selected_line.get_buy_x_get_dis_y()){
					if(selected_line.get_quantity() < 1){
						_.each(lines, function(line){
							if(line && line.get_buy_x_get_y_child_item()){
								line.set_discount(0);
								line.set_buy_x_get_y_child_item({});
								line.set_promotion_data("");
								line.set_is_rule_applied(false);
								self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
							}
						});
					}
				}else if(selected_line.get_quantity_discount()){
					selected_line.set_quantity_discount({});
					selected_line.set_promotion_data("");
					selected_line.set_discount(0);
					selected_line.set_is_rule_applied(false);
				}else if(selected_line.get_discount_amt()){
					selected_line.set_discount_amt_rule(false);
					selected_line.set_promotion_data("");
					selected_line.set_discount_amt(0);
					selected_line.set_unit_price(selected_line.product.list_price);
					selected_line.set_is_rule_applied(false);
				}
				else if(selected_line.get_multi_prods_line_id()){
					var multi_prod_id = selected_line.get_multi_prods_line_id() || false;
					if(multi_prod_id){
						_.each(lines, function(_line){
							if(_line && _line.get_multi_prods_line_id() == multi_prod_id){
								_line.set_discount(0);
								_line.set_is_rule_applied(false);
								_line.set_promotion_data(false);
								self.pos.chrome.screens.products.order_widget.rerender_orderline(_line);
							}
						});
					}
				}
			}
	    },
        apply_promotion: function(){
    		var self = this;
    		if(!self.pos.config.pos_promotion || !self.pos.get_cashier().access_pos_promotion){
    			return;
    		}
			var order = self.pos.get_order();
			var lines = order.get_new_order_lines();
			var promotion_list = self.pos.pos_promotions;
			var condition_list = self.pos.pos_conditions;
			var discount_list = self.pos.pos_get_discount;
			var pos_get_qty_discount_list = self.pos.pos_get_qty_discount;
			var pos_qty_discount_amt = self.pos.pos_qty_discount_amt;
			var pos_discount_multi_prods = self.pos.pos_discount_multi_prods;
			var pos_discount_multi_categ = self.pos.pos_discount_multi_categ;
			var pos_discount_above_price = self.pos.pos_discount_above_price;
			var selected_line = self.pos.get_order().get_selected_orderline();
			if(order && lines && lines[0]){
				_.each(lines, function(line){
					if(promotion_list && promotion_list[0]){
						_.each(promotion_list, function(promotion){
							if(promotion && promotion.promotion_type == "buy_x_get_y"){
								if(promotion.pos_condition_ids && promotion.pos_condition_ids[0]){
									_.each(promotion.pos_condition_ids, function(pos_condition_line_id){
										var line_record = _.find(condition_list, function(obj) { return obj.id == pos_condition_line_id});
										if(line_record){
											if(line_record.product_x_id && line_record.product_x_id[0] == line.product.id){
												if(line_record.operator == 'is_eql_to'){
													if(line_record.quantity == line.quantity){
														if(line_record.product_y_id && line_record.product_y_id[0]){
															var product = self.pos.db.get_product_by_id(line_record.product_y_id[0]);
															var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
															new_line.set_quantity(line_record.quantity_y);
															new_line.set_unit_price(0);
															new_line.set_promotion({
																'prom_prod_id':line_record.product_y_id[0],
																'parent_product_id':line_record.product_x_id[0],
																'rule_name':promotion.promotion_code,
															});
															new_line.set_promotion_data(promotion);
															new_line.set_is_rule_applied(true);
									                        order.add_orderline(new_line);
									                        line.set_child_line_id(new_line.id);
									                        line.set_is_rule_applied(true);
														}
													}
												}else if(line_record.operator == 'greater_than_or_eql'){
													var data = order.get_product_qty(line.product.id);
//													if(line.quantity >= line_record.quantity){
													if(data.total_qty >= line_record.quantity){
														if(line_record.product_y_id && line_record.product_y_id[0]){
															var product = self.pos.db.get_product_by_id(line_record.product_y_id[0]);
															var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
															new_line.set_quantity(line_record.quantity_y);
															new_line.set_unit_price(0);
															new_line.set_promotion({
																'prom_prod_id':line_record.product_y_id[0],
																'parent_product_id':line_record.product_x_id[0],
																'rule_name':promotion.promotion_code,
															});
															new_line.set_promotion_data(promotion);
															new_line.set_is_rule_applied(true);
									                        order.add_orderline(new_line);
									                        if(data.line_ids[0]){
																data.line_ids.map(function(line_id){
																	var temp_line = order.get_orderline(line_id);
																	if(temp_line){
																		temp_line.set_child_line_id(new_line.id);
																		temp_line.set_is_rule_applied(true);
																	}
																});
															}
														}
													}
												}
											}
										}
									});
								}
							}else if(promotion && promotion.promotion_type == "buy_x_get_dis_y"){
								if(promotion.parent_product_ids && promotion.parent_product_ids[0] && (jQuery.inArray(line.product.id,promotion.parent_product_ids) != -1)){
									var disc_line_ids = [];
									_.each(promotion.pos_quntity_dis_ids, function(pos_quntity_dis_id){
										var disc_line_record = _.find(discount_list, function(obj) { return obj.id == pos_quntity_dis_id});
										if(disc_line_record){
											if(disc_line_record.product_id_dis && disc_line_record.product_id_dis[0]){
												disc_line_ids.push(disc_line_record);
											}
										}
									});
									line.set_buy_x_get_dis_y({
										'disc_line_ids':disc_line_ids,
										'promotion':promotion,
									});
								}
								if(line.get_buy_x_get_dis_y().disc_line_ids){
									_.each(line.get_buy_x_get_dis_y().disc_line_ids, function(disc_line){
										_.each(lines, function(orderline){
											if(disc_line.product_id_dis && disc_line.product_id_dis[0] == orderline.product.id){
												orderline.set_discount(disc_line.discount_dis_x);
												orderline.set_buy_x_get_y_child_item({
													'rule_name':line.get_buy_x_get_dis_y().promotion.promotion_code
												});
												orderline.set_promotion_data(line.get_buy_x_get_dis_y().promotion);
												orderline.set_is_rule_applied(true);
												self.pos.chrome.screens.products.order_widget.rerender_orderline(orderline);
												return false;
											}
										});
									});
								}
							}else if(promotion && promotion.promotion_type == "quantity_discount"){
								if(promotion.product_id_qty && promotion.product_id_qty[0] == line.product.id){
									var line_ids = [];
									_.each(promotion.pos_quntity_ids, function(pos_quntity_id){
										var line_record = _.find(pos_get_qty_discount_list, function(obj) { return obj.id == pos_quntity_id});
										if(line_record){
											if(line.get_quantity() >= line_record.quantity_dis){
												if(line_record.discount_dis){
													line.set_discount(line_record.discount_dis);
													line.set_quantity_discount({
														'rule_name':promotion.promotion_code,
													});
													line.set_promotion_data(promotion);
													line.set_is_rule_applied(true);
													self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
													return false;
												}
											}
										}
									});
								}
							}else if(promotion && promotion.promotion_type == "quantity_price"){
								if(promotion.product_id_amt && promotion.product_id_amt[0] == line.product.id){
									var line_ids = [];
									_.each(promotion.pos_quntity_amt_ids, function(pos_quntity_amt_id){
										var line_record = _.find(pos_qty_discount_amt, function(obj) { return obj.id == pos_quntity_amt_id});
										if(line_record){
											if(line.get_quantity() == line_record.quantity_amt){
												if(line_record.discount_price){
													line.set_discount_amt(line_record.discount_price);
													line.set_discount_amt_rule(promotion.promotion_code);
													line.set_promotion_data(promotion);
//													line.set_unit_price(((line.get_unit_price()*line.get_quantity()) - line_record.discount_price)/line.get_quantity());
													line.set_unit_price(line_record.discount_price);
													line.set_is_rule_applied(true);
													self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
													return false;
												}
											}
										}
									});
								}
							}else if(promotion && promotion.promotion_type == "discount_on_multi_product"){
								if(promotion.multi_products_discount_ids && promotion.multi_products_discount_ids[0]){
									_.each(promotion.multi_products_discount_ids, function(disc_line_id){
										var disc_line_record = _.find(pos_discount_multi_prods, function(obj) { return obj.id == disc_line_id});
										if(disc_line_record){
											self.check_products_for_disc(disc_line_record, promotion);
										}
									})
								}
							}else if(promotion && promotion.promotion_type == "discount_on_multi_categ"){
								if(promotion.multi_categ_discount_ids && promotion.multi_categ_discount_ids[0]){
									_.each(promotion.multi_categ_discount_ids, function(disc_line_id){
										var disc_line_record = _.find(pos_discount_multi_categ, function(obj) { return obj.id == disc_line_id});
										if(disc_line_record){
											self.check_categ_for_disc(disc_line_record, promotion);
										}
									})
								}
							}else if(promotion && promotion.promotion_type == "discount_on_above_price"){
								if(promotion && promotion.discount_price_ids && promotion.discount_price_ids[0]){
									_.each(promotion.discount_price_ids, function(line_id){
										var line_record = _.find(pos_discount_above_price, function(obj) { return obj.id == line_id});
										if(line_record && line_record.product_brand_ids && line_record.product_brand_ids[0] 
											&& line_record.product_categ_ids && line_record.product_categ_ids[0]){
											if(line.product.product_brand_id && line.product.product_brand_id[0]){
												if($.inArray(line.product.product_brand_id[0], line_record.product_brand_ids) != -1){
													if(line.product.pos_categ_id){
														var product_category = self.pos.db.get_category_by_id(line.product.pos_categ_id[0])
														if(product_category){
															if($.inArray(product_category.id, line_record.product_categ_ids) != -1){
																if(line_record.price && line_record.discount){
																	if(line.product.list_price >= line_record.price && line.quantity > 0){
																		line.set_discount(line_record.discount);
																		line.set_is_rule_applied(true);
																		line.set_promotion_data(promotion);
																	}
																}
															}
														}
													}
												}
											}
										}else if(line_record.product_brand_ids.length == 0 && line_record.product_categ_ids.length > 0){
											if(line.product.pos_categ_id){
												var product_category = self.pos.db.get_category_by_id(line.product.pos_categ_id[0])
												if(product_category){
													if($.inArray(product_category.id, line_record.product_categ_ids) != -1){
														if(line_record.price && line_record.discount){
															if(line.product.list_price >= line_record.price && line.quantity > 0){
																line.set_discount(line_record.discount);
																line.set_is_rule_applied(true);
																line.set_promotion_data(promotion);
																self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
															}
														}
													}
												}
											}
										}else if(line_record.product_categ_ids.length == 0 && line_record.product_brand_ids.length > 0){
											if(line.product.product_brand_id && line.product.product_brand_id[0]){
												if($.inArray(line.product.product_brand_id[0], line_record.product_brand_ids) != -1){
													if(line_record.price && line_record.discount){
														if(line.product.list_price >= line_record.price && line.quantity > 0){
															line.set_discount(line_record.discount);
															line.set_is_rule_applied(true);
															line.set_promotion_data(promotion);
															self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
														}
													}
												}
											}
										}
									});
								}
							}
						});
					}
				});
			}
    	},
    	check_products_for_disc: function(disc_line, promotion){
    		var self = this;
    		var product_ids = disc_line.product_ids;
    		var discount = disc_line.products_discount;
    		var order = self.pos.get_order();
    		var lines = self.get_new_order_lines();
    		var product_cmp_list = [];
    		var orderline_ids = [];
    		var products_qty = [];
    		if(product_ids && product_ids[0] && discount){
    			_.each(lines, function(line){
        			if(jQuery.inArray(line.product.id,product_ids) != -1){
        				product_cmp_list.push(line.product.id);
        				orderline_ids.push(line.id);
        				products_qty.push(line.get_quantity());
        			}
        		});
    			if(!_.contains(products_qty, 0)){
    				if(_.isEqual(_.sortBy(product_ids), _.sortBy(product_cmp_list))){
            			_.each(orderline_ids, function(orderline_id){
            				var orderline = order.get_orderline(orderline_id);
            				if(orderline && orderline.get_quantity() > 0){
            					orderline.set_discount(discount);
            					orderline.set_multi_prods_line_id(disc_line.id);
            					orderline.set_is_rule_applied(true);
            					orderline.set_promotion_data(promotion);
            					orderline.set_combinational_product_rule(promotion.promotion_code);
            					self.pos.chrome.screens.products.order_widget.rerender_orderline(orderline);
            				}
            			});
            		}
    			}
    		}
    	},
    	check_categ_for_disc: function(disc_line, promotion){
    		var self = this;
    		var order = self.pos.get_order();
    		var lines = self.get_new_order_lines();
    		var categ_ids = disc_line.categ_ids;
    		var discount = disc_line.categ_discount;
    		if(categ_ids && categ_ids[0] && discount){
    			_.each(categ_ids, function(categ_id){
    				var products = self.pos.db.get_product_by_category(categ_id);
    				if(products && products[0]){
    					_.each(lines, function(line){
    						if($.inArray(line.product, products) != -1){
    							line.set_discount(discount);
    							line.set_is_rule_applied(true);
    							line.set_promotion_data(promotion);
    							line.set_multi_prod_categ_rule(promotion.promotion_code);
            					self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
    						}
    					});
    				}
    			});
    		}
    	},
    	get_new_order_lines: function(){
    		var self = this;
    		var order = self.pos.get_order();
			var lines = order.get_orderlines();
			var new_lines = [];
			_.each(lines, function(line){
				if(line && line.get_quantity() > 0 && !line.get_is_rule_applied()){
					new_lines.push(line);
				}
			});
			return new_lines;
    	},
    	calculate_discount_amt: function(){
    		var self = this;
    		var order = self.pos.get_order();
    		var total = order ? order.get_total_with_tax() : 0;
    		var promotion_list = self.pos.pos_promotions;
    		var discount = 0;
    		if(promotion_list && promotion_list[0]){
    			_.each(promotion_list, function(promotion){
    				if(promotion.promotion_type == 'dicount_total'){
    					if(promotion.operator == 'greater_than_or_eql'){
    						if(promotion.total_amount && total >= promotion.total_amount){
    							if(promotion.discount_product && promotion.discount_product[0]){
    								discount = (total * promotion.total_discount)/100;
    								order.set_discount_product_id(promotion.discount_product[0]);
    							}
    						}
    					}else if(promotion.operator == 'is_eql_to'){
    						if(promotion.total_amount && total == promotion.total_amount){
    							if(promotion.discount_product && promotion.discount_product[0]){
    								discount = (total * promotion.total_discount)/100;
    								order.set_discount_product_id(promotion.discount_product[0]);
    							}
    						}
    					}
    				}
    			});
    		}
    		return Number(discount);
    	},
    	get_total_without_tax: function() {
    		var result = _super_Order.get_total_without_tax.call(this);
    		return result - this.get_order_total_discount();
    	},
        set_order_total_discount: function(order_total_discount){
        	this.order_total_discount = order_total_discount;
        },
        get_order_total_discount: function(){
        	return this.order_total_discount;
        },
        set_discount_price: function(discount_price){
        	this.discount_price = discount_price;
        },
        get_discount_price: function(){
        	return this.discount_price;
        },
        set_discount_product_id: function(discount_product_id){
        	this.discount_product_id = discount_product_id;
        },
        get_discount_product_id: function(){
        	return this.discount_product_id;
        },
     // Order History
        set_sequence:function(sequence){
        	this.set('sequence',sequence);
        },
        get_sequence:function(){
        	return this.get('sequence');
        },
        set_order_id: function(order_id){
            this.set('order_id', order_id);
        },
        get_order_id: function(){
            return this.get('order_id');
        },
        set_amount_paid: function(amount_paid) {
            this.set('amount_paid', amount_paid);
        },
        get_amount_paid: function() {
            return this.get('amount_paid');
        },
        set_amount_return: function(amount_return) {
            this.set('amount_return', amount_return);
        },
        get_amount_return: function() {
            return this.get('amount_return');
        },
        set_amount_tax: function(amount_tax) {
            this.set('amount_tax', amount_tax);
        },
        get_amount_tax: function() {
            return this.get('amount_tax');
        },
        set_amount_total: function(amount_total) {
            this.set('amount_total', amount_total);
        },
        get_amount_total: function() {
            return this.get('amount_total');
        },
        set_company_id: function(company_id) {
            this.set('company_id', company_id);
        },
        get_company_id: function() {
            return this.get('company_id');
        },
        set_date_order: function(date_order) {
            this.set('date_order', date_order);
        },
        get_date_order: function() {
            return this.get('date_order');
        },
        set_pos_reference: function(pos_reference) {
            this.set('pos_reference', pos_reference)
        },
        get_pos_reference: function() {
            return this.get('pos_reference')
        },
        set_user_name: function(user_id) {
            this.set('user_id', user_id);
        },
        get_user_name: function() {
            return this.get('user_id');
        },
        set_journal: function(statement_ids) {
            this.set('statement_ids', statement_ids)
        },
        get_journal: function() {
            return this.get('statement_ids');
        },
     //Rounding
        set_rounding_status: function(rounding_status) {
    		this.rounding_status = rounding_status
    	},
    	get_rounding_status: function() {
    		return this.rounding_status;
    	},
        getNetTotalTaxIncluded: function() {
        	var total = this.get_total_with_tax();
        	if(this.get_rounding_status()){
	        	if(this.pos.config.enable_rounding && this.pos.config.rounding_options == 'digits'){
	        		var value = round_pr(Math.max(0,total))//decimalAdjust(total);
	                return value;
	        	}else if(this.pos.config.enable_rounding && this.pos.config.rounding_options == 'points'){
	        		var total = this.get_total_without_tax() + this.get_total_tax();
	                var value = decimalAdjust(total);
	                return value;
	        	}
        	}else {
        		return total
        	}
        },
        get_rounding : function(){
        	if(this.get_rounding_status()){
	            var total = this ? this.get_total_with_tax() : 0;
	            var rounding = this ? this.getNetTotalTaxIncluded() - total: 0;
	            return rounding;
        	}
        },
        get_due: function(paymentline) {
            if (!paymentline) {
                var due = this.getNetTotalTaxIncluded() - this.get_total_paid();
            } else {
                var due = this.getNetTotalTaxIncluded();
                var lines = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i] === paymentline) {
                        break;
                    } else {
                        due -= lines[i].get_amount();
                    }
                }
            }
            return round_pr(Math.max(0,due), this.pos.currency.rounding);
        },
        get_change: function(paymentline) {
            if (!paymentline) {
            	  if(this.get_total_paid() > 0 || this.get_cancel_order()){
            		  var change = this.get_total_paid() - this.getNetTotalTaxIncluded() - this.get_order_total_discount();
                  }else{
                      var change = this.get_amount_return();
                  }
            } else {
                var change = -this.getNetTotalTaxIncluded();
                var lines  = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    change += lines[i].get_amount();
                    if (lines[i] === paymentline) {
                        break;
                    }
                }
            }
            return round_pr(Math.max(0,change), this.pos.currency.rounding);
        },
        set_delivery_address: function(delivery_address){
        	this.delivery_address = delivery_address;
        },
        get_delivery_address: function(){
        	return this.delivery_address;
        },
        set_delivery_charge_amt: function(delivery_charge_amt){
        	this.delivery_charge_amt = delivery_charge_amt;
        },
        get_delivery_charge_amt: function(){
        	return this.delivery_charge_amt;
        },
        set_delivery_date: function(delivery_date) {
            this.delivery_date = delivery_date;
        },
        get_delivery_date: function() {
            return this.delivery_date;
        },
        set_delivery_time: function(delivery_time) {
            this.delivery_time = delivery_time;
        },
        get_delivery_time: function() {
            return this.delivery_time;
        },
        set_delivery: function(delivery) {
            this.delivery = delivery;
        },
        get_delivery: function() {
            return this.delivery;
        },
        set_delivery_charges: function(delivery_state) {
            this.delivery_state = delivery_state;
        },
        get_delivery_charges: function() {
            return this.delivery_state;
        },
        set_is_delivery: function(is_delivery) {
            this.is_delivery = is_delivery;
        },
        get_is_delivery: function() {
            return this.is_delivery;
        },
        count_to_be_deliver:function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	var lines = order.get_orderlines();
	    	var count = 0;
			for(var i=0;i<lines.length;i++){
				if(lines[i].get_deliver_info()){
					count = count + 1;
				}
			}
			if(count === 0){
				for(var j=0; j<lines.length;j++){
					if(lines[j].get_delivery_charges_flag()){
						order.remove_orderline(lines[j]);
						order.set_is_delivery(false);
						$('#delivery_mode').removeClass('deliver_on');
					}
				}
			}
	    },
	    //loyalty
	    set_loyalty_redeemed_point: function(val){
    		this.set('loyalty_redeemed_point', Number(val).toFixed(2));
    	},
    	get_loyalty_redeemed_point: function(){
    		return this.get('loyalty_redeemed_point') || 0.00;
    	},
    	set_loyalty_redeemed_amount: function(val){
    		this.set('loyalty_redeemed_amount', val);
    	},
    	get_loyalty_redeemed_amount: function(){
    		return this.get('loyalty_redeemed_amount') || 0.00;
    	},
    	set_loyalty_earned_point: function(val){
    		this.set('loyalty_earned_point', val);
    	},
    	get_loyalty_earned_point: function(){
    		return this.get('loyalty_earned_point') || 0.00;
    	},
    	set_loyalty_earned_amount: function(val){
    		this.set('loyalty_earned_amount', val);
    	},
    	get_loyalty_earned_amount: function(){
    		return this.get('loyalty_earned_amount') || 0.00;
    	},
    	get_loyalty_amount_by_point: function(point){
    		if(this.pos.loyalty_config){
    			return (point * this.pos.loyalty_config.to_amount) / this.pos.loyalty_config.points;
    		}
	    },
	    set_giftcard: function(giftcard) {
            this.giftcard.push(giftcard)
        },
        get_giftcard: function() {
            return this.giftcard;
        },
        set_recharge_giftcard: function(recharge) {
            this.recharge.push(recharge)
        },
        get_recharge_giftcard: function(){
            return this.recharge;
        },
        set_redeem_giftcard: function(redeem) {
            this.redeem.push(redeem)
        },
        get_redeem_giftcard: function() {
            return this.redeem;
        },
        remove_card:function(code){ 
            var redeem = _.reject(this.redeem, function(objArr){ return objArr.redeem_card == code });
            this.redeem = redeem
        },
        set_free_data: function(freedata) {
            this.freedata = freedata;
        },
        get_free_data: function() {
            return this.freedata;
        },
        set_voucher: function(voucher) {
            this.voucher.push(voucher)
        },
        get_voucher: function() {
        	return this.voucher;
        },
        remove_voucher: function(barcode, pid){
        	this.voucher = _.reject(this.voucher, function(objArr){ return objArr.voucher_code == barcode && objArr.pid == pid; });
        },
        set_remaining_redeemption: function(vals){
            this.remaining_redeemption = vals;
        },
        get_remaining_redeemption: function(){
            return this.remaining_redeemption;
        },
        set_type_for_wallet: function(type_for_wallet) {
            this.set('type_for_wallet', type_for_wallet);
        },
        get_type_for_wallet: function() {
            return this.get('type_for_wallet');
        },
        set_change_amount_for_wallet: function(change_amount_for_wallet) {
            this.set('change_amount_for_wallet', change_amount_for_wallet);
        },
        get_change_amount_for_wallet: function() {
            return this.get('change_amount_for_wallet');
        },
        set_use_wallet: function(use_wallet) {
            this.set('use_wallet', use_wallet);
        },
        get_use_wallet: function() {
            return this.get('use_wallet');
        },
        set_used_amount_from_wallet: function(used_amount_from_wallet) {
            this.set('used_amount_from_wallet', used_amount_from_wallet);
        },
        get_used_amount_from_wallet: function() {
            return this.get('used_amount_from_wallet');
        },
        get_dummy_product_ids: function(){
        	var list_ids = [];
        	if(this.pos.config.delivery_product_id)
        		list_ids.push(this.pos.config.delivery_product_id[0]);
        	if(this.pos.config.gift_card_product_id)
        		list_ids.push(this.pos.config.gift_card_product_id[0]);
        	if(this.pos.config.payment_product_id)
        		list_ids.push(this.pos.config.payment_product_id[0]);
        	if(this.pos.config.wallet_product)
        		list_ids.push(this.pos.config.wallet_product[0]);
        	if(this.pos.config.cancellation_charges_product_id)
        		list_ids.push(this.pos.config.cancellation_charges_product_id[0]);
        	if(this.pos.config.prod_for_payment)
        		list_ids.push(this.pos.config.prod_for_payment[0]);
        	if(this.pos.config.refund_amount_product_id)
        		list_ids.push(this.pos.config.refund_amount_product_id[0]);
        	if(this.pos.db.get_dummy_product_ids().length > 0){
        		this.pos.db.get_dummy_product_ids().map(function(dummy_id){
        			if(!_.contains(list_ids, dummy_id)){
        				list_ids.push(dummy_id);
        			}
        		});
        	}
        	return list_ids;
        },
        remove_orderline: function(line){
        	var self = this;
        	_super_Order.remove_orderline.call(this, line);
        	if(line){
        		var lines = this.get_orderlines();
            	if(line && line.get_child_line_id()){
    				var child_line = self.get_orderline(line.get_child_line_id());
					lines.map(function(_line){
						if(_line.get_child_line_id() == line.get_child_line_id()){
							_line.set_child_line_id(false);
							_line.set_is_rule_applied(false);
						}
					});
					if(child_line){
						line.set_child_line_id(false);
						line.set_is_rule_applied(false);
						self.remove_orderline(child_line);
						self.apply_promotion();
					}
    			}else if(line.get_buy_x_get_dis_y()){
    				_.each(lines, function(_line){
    					if(_line && _line.get_buy_x_get_y_child_item()){
    						_line.set_discount(0);
    						_line.set_buy_x_get_y_child_item({});
    						_line.set_is_rule_applied(false);
    						self.pos.chrome.screens.products.order_widget.rerender_orderline(_line);
    					}
    				});
    			}else if(line.get_multi_prods_line_id()){
    				var multi_prod_id = line.get_multi_prods_line_id() || false;
    				if(multi_prod_id){
    					_.each(lines, function(_line){
    						if(_line && _line.get_multi_prods_line_id() == multi_prod_id){
    							_line.set_discount(0);
    							_line.set_is_rule_applied(false);
    							_line.set_combinational_product_rule(false);
    							self.pos.chrome.screens.products.order_widget.rerender_orderline(_line);
    						}
    					});
    				}
    			}
        	}
        },
        add_paymentline: function(cashregister) {
	    	_super_Order.add_paymentline.call(this,cashregister);
	        var total = this.get_total_with_tax();
	        var paymentline = this.get_paymentlines();
	        _.each(paymentline, function(line){
	        	if(line.selected && total < 0){
	        		line.set_amount(total);
	        	}
	        });
	    },
	    add_paymentline_by_journal: function(cashregister) {
            this.assert_editable();
            var newPaymentline = new models.Paymentline({}, {order: this, cashregister:cashregister, pos: this.pos})
            var newPaymentline = new models.Paymentline({}, {order: this, cashregister:cashregister, pos: this.pos})
            if((this.pos.get_order().get_due() > 0) && (this.pos.get_order().get_client().remaining_credit_amount > this.pos.get_order().get_due())) {
                newPaymentline.set_amount(Math.min(this.pos.get_order().get_due(),this.pos.get_order().get_client().remaining_credit_amount));
            }else if((this.pos.get_order().get_due() > 0) && (this.pos.get_order().get_client().remaining_credit_amount < this.pos.get_order().get_due())) {
                newPaymentline.set_amount(Math.min(this.pos.get_order().get_due(),this.pos.get_order().get_client().remaining_credit_amount));
            }else if(this.pos.get_order().get_due() > 0) {
                    newPaymentline.set_amount( Math.max(this.pos.get_order().get_due(),0) );
            }
            this.paymentlines.add(newPaymentline);
            this.select_paymentline(newPaymentline);
        },
        set_records: function(records) {
    	    this.records = records;
    	},
    	get_records: function() {
    	    return this.records;
    	},
	    get_remaining_credit: function(){
    		var credit_total = 0.00,use_credit = 0.00;
    		var self = this;
    		var partner = self.pos.get_client();
            if(partner){
                var client_account = partner.deposite_info['content'];
                var credit_detail = this.get_credit_detail();
                _.each(client_account, function(values){
                    credit_total = values.amount + credit_total
                });
                if(credit_detail && credit_detail.length > 0 && client_account && client_account.length > 0){
                	for (var i=0;i<client_account.length;i++){
            			for(var j=0;j<credit_detail.length;j++){
                    		if(client_account[i].id == credit_detail[j].journal_id){
                    			use_credit += Math.abs(credit_detail[j].amount)
                    		}
                    	}
                    }
                }
            }
            if(use_credit){
            	return 	credit_total - use_credit;
            } else{
            	return false
            }
    	},
    	// Debit Management
    	set_is_debit: function(is_debit) {
    		this.set('is_debit',is_debit);
    	},
    	get_is_debit: function(){
    		return this.get('is_debit');
    	},
	    export_as_JSON: function() {
	    	var self = this;
            var orders = _super_Order.export_as_JSON.call(this);
            var parent_return_order = '';
            var ret_o_id = this.get_ret_o_id();
            var ret_o_ref = this.get_ret_o_ref();
            var return_seq = 0;
            if (ret_o_id) {
                parent_return_order = this.get_ret_o_id();
            }
            var backOrders_list = [];
            _.each(this.get_orderlines(),function(item) {
                if (item.get_back_order()) {
                    backOrders_list.push(item.get_back_order());
                }
            });
        	var unique_backOrders = "";
            for ( var i = 0 ; i < backOrders_list.length ; ++i ) {
                if ( unique_backOrders.indexOf(backOrders_list[i]) == -1 && backOrders_list[i] != "" )
                	unique_backOrders += backOrders_list[i] + ', ';
            }
            var cancel_orders = '';
            _.each(self.get_orderlines(), function(line){
                if(line.get_cancel_item()){
                    cancel_orders += " "+line.get_cancel_item();
                }
            });
            var new_val = {
                is_debit : this.get_is_debit() || false,
                customer_email: this.get_ereceipt_mail(),
                prefer_ereceipt: this.get_prefer_ereceipt(),
                order_note: this.get_order_note(),
                parent_return_order: parent_return_order,
                return_seq: return_seq || 0,
                back_order: unique_backOrders,
                sale_mode: this.get_sale_mode(),
                old_order_id: this.get_order_id(),
                sequence: this.get_sequence(),
                pos_reference: this.get_pos_reference(),
                rounding: this.get_rounding(),
                is_rounding: this.pos.config.enable_rounding,
                rounding_option: this.pos.config.enable_rounding ? this.pos.config.rounding_options : false,
        		delivery_date: this.get_delivery_date(),
        		delivery_time: this.get_delivery_time(),
        		delivery_address: this.get_delivery_address(),
        		delivery_charge_amt: this.get_delivery_charge_amt(),
        		loyalty_redeemed_point: this.get_loyalty_redeemed_point() || false,
            	loyalty_redeemed_amount: this.get_loyalty_redeemed_amount() || false,
            	loyalty_earned_point: this.get_loyalty_earned_point() || false,
            	loyalty_earned_amount: this.get_loyalty_earned_amount() || false,
            	giftcard: this.get_giftcard() || false,
                redeem: this.get_redeem_giftcard() || false,
                recharge: this.get_recharge_giftcard() || false,
                voucher: this.get_voucher() || false,
                wallet_type: this.get_type_for_wallet() || false,
            	change_amount_for_wallet: this.get_change_amount_for_wallet() || false,
        		used_amount_from_wallet: this.get_used_amount_from_wallet() || false,
        		//Credit Management
        		amount_due: this.get_due() ? this.get_due() : 0.00,
                credit_type: this.get_type_for_credit() || false,
                change_amount_for_credit: this.get_change_amount_for_credit() || false,
                is_delivery: this.get_delivery() || false,
                credit_detail: this.get_credit_detail(),
        		//Reservation
        		amount_due: this.get_due() ? this.get_due() : 0.00,
                reserved: this.get_reservation_mode() || false,
                reserve_delivery_date: this.get_reserve_delivery_date() || false,
                cancel_order_ref: cancel_orders || false,
                cancel_order: this.get_cancel_order() || false,
                set_as_draft: this.get_draft_order() || false,
                customer_email: this.get_client() ? this.get_client().email : false,
                fresh_order: this.get_fresh_order() || false,
                partial_pay: this.get_partial_pay() || false,
                shop_id : self.pos.config.multi_shop_id ? self.pos.config.multi_shop_id[0] : false,
            }
            $.extend(orders, new_val);
            return orders;
        },
        export_for_printing: function(){
            var orders = _super_Order.export_for_printing.call(this);
            var order_no = this.get_name() || false ;
            var self = this;
            var order_no = order_no ? this.get_name().replace(_t('Order '),'') : false;
            var last_paid_amt = 0;
            var currentOrderLines = this.get_orderlines();
            if(currentOrderLines.length > 0) {
            	_.each(currentOrderLines,function(item) {
            		if(item.get_product().id == self.pos.config.prod_for_payment[0] ){
            			last_paid_amt = item.get_display_price()
            		}
                });
            }
            var total_paid_amt = this.get_total_paid()-last_paid_amt
            var new_val = {
            	order_note: this.get_order_note() || false,
            	ret_o_id: this.get_ret_o_id(),
        		order_no: order_no,
        		reprint_payment: this.get_journal() || false,
            	ref: this.get_pos_reference() || false,
            	date_order: this.get_date_order() || false,
            	rounding: this.get_rounding(),
            	net_amount: this.getNetTotalTaxIncluded(),
            	total_points: this.get_total_loyalty_points() || false,
    			earned_points: this.get_loyalty_earned_point() || false,
    			redeem_points: this.get_loyalty_redeemed_point() || false,
    			client_points: this.get_client() ? this.get_client().total_remaining_points.toFixed(2) : false,
				giftcard: this.get_giftcard() || false,
                recharge: this.get_recharge_giftcard() || false,
                redeem:this.get_redeem_giftcard() || false,
                free:this.get_free_data()|| false,
                remaining_redeemption: this.get_remaining_redeemption() || false,
                
                //reservation
                reprint_payment: this.get_journal() || false,
            	ref: this.get_pos_reference() || false,
            	last_paid_amt: last_paid_amt || 0,
            	total_paid_amt: total_paid_amt || false,
            	amount_due: this.get_due() ? this.get_due() : 0.00,
            	old_order_id: this.get_order_id(),
            	reserve_delivery_date: moment(this.get_reserve_delivery_date()).locale("en").format('L') || false,
            };
            $.extend(orders, new_val);
            return orders;
        },
        remove_paymentline: function(line){
    		this.set_loyalty_redeemed_point(this.get_loyalty_redeemed_point() - line.get_loyalty_point());
    		this.set_loyalty_redeemed_amount(this.get_loyalty_amount_by_point(this.get_loyalty_redeemed_point()));
    		_super_Order.remove_paymentline.apply(this, arguments);
    	},
    	get_total_loyalty_points: function(){
    		var temp = 0.00
    		if(this.get_client()){
	    		temp = Number(this.get_client().total_remaining_points) 
	    				+ Number(this.get_loyalty_earned_point()) 
	    				- Number(this.get_loyalty_redeemed_point())
    		}
    		return temp.toFixed(2)
    	},
        set_result: function(result) {
            this.set('result', result);
        },
        get_result: function() {
            return this.get('result');
        },
        // POS Serial/lots
        set_print_serial: function(val) {
    		this.print_serial = val
    	},
    	get_print_serial: function() {
    		return this.print_serial;
    	},
    	display_lot_popup: function() {
    		var self = this;
            var order_line = this.get_selected_orderline();
            if(order_line && order_line.product.type == "product"){
            	var pack_lot_lines =  order_line.compute_lot_lines();
            	var product_id = order_line.get_product().id;
            	if(this.pos.config.enable_pos_serial){
                	if(product_id){
                        var params = {
                            model: 'stock.production.lot',
                            method: 'search_read',
                            domain: [['product_id', '=', product_id]],
                        }
                        rpc.query(params, {async: false}).then(function(serials){
                            if(serials){
                                self.pos.gui.show_popup('packlotline', {
                                    'title': _t('Lot/Serial Number(s) Required'),
                                    'pack_lot_lines': pack_lot_lines,
                                    'order': self,
                                    'serials': serials
                                });
                            }
                        });
        	        }
                } else {
                	self.pos.gui.show_popup('packlotline', {
                        'title': _t('Lot/Serial Number(s) Required'),
                        'pack_lot_lines': pack_lot_lines,
                        'order': self,
                        'serials': []
                    });
                }
            }
        },
//        Product summary report
        set_order_summary_report_mode: function(order_summary_report_mode) {
            this.order_summary_report_mode = order_summary_report_mode;
        },
        get_order_summary_report_mode: function() {
            return this.order_summary_report_mode;
        },
        set_product_summary_report :function(product_summary_report) {
            this.product_summary_report = product_summary_report;
        },
        get_product_summary_report: function() {
            return this.product_summary_report;
        },
        set_result_expire_graph: function(result) {
            this.set('result', result);
        },
        get_result_expire_graph: function() {
            return this.get('result');
        },
//        Credit Management
        set_type_for_credit: function(type_for_credit) {
            this.set('type_for_credit', type_for_credit);
        },
        get_type_for_credit: function() {
            return this.get('type_for_credit');
        },
        set_change_amount_for_credit: function(change_amount_for_credit) {
            this.set('change_amount_for_credit', change_amount_for_credit);
        },
        get_change_amount_for_credit: function() {
            return this.get('change_amount_for_credit');
        },
        set_ledger_click: function(ledger_click){
    	    this.ledger_click = ledger_click;
    	},
    	get_ledger_click: function() {
    	    return this.ledger_click;
    	},
    	set_change_and_cash: function(change_and_cash) {
            this.change_and_cash = change_and_cash;
        },
        get_change_and_cash: function() {
            return this.change_and_cash;
        },
        set_use_credit: function(use_credit) {
            this.set('use_credit', use_credit);
        },
        get_use_credit: function() {
            return this.get('use_credit');
        },
        set_client_name: function(client_name){
            this.client_name = client_name;
        },
        get_client_name: function(){
            return this.client_name;
        },
        set_credit_mode: function(credit_mode) {
            this.credit_mode = credit_mode;
        },
        get_credit_mode: function() {
            return this.credit_mode;
        },
	    set_credit_detail: function(credit_detail) {
//	        var data = this.get('credit_detail')
            var data = [];
	        if(data){
	            data.push(credit_detail);
	        }
	        this.set('credit_detail',data);
        },
        get_credit_detail: function() {
            return this.get('credit_detail')
        },
        set_customer_credit:function(){
            var data = this.get('customer_credit')
	        data = true;
	        this.set('customer_credit',data);
        },
        get_customer_credit: function() {
            return this.get('customer_credit')
        },
        set_paying_order: function(val){
        	this.set('paying_order',val)
        },
        get_paying_order: function(){
        	return this.get('paying_order')
        },
//        Sale Summary Dashboard
        set_graph_data_journal: function(result) {
            this.set('result_graph_data_journal', result);
        },
        get_graph_data_journal: function() {
            return this.get('result_graph_data_journal');
        },
        set_active_session_sales: function(active_session_sale){
        	this.set('active_session_sale',active_session_sale)
        },
        get_active_session_sales: function(){
        	return this.get('active_session_sale');
        },
        set_closed_session_sales: function(closed_session_sale){
        	this.set('closed_session_sale',closed_session_sale)
        },
        get_closed_session_sales: function(){
        	return this.get('closed_session_sale');
        },
        set_hourly_summary: function(hourly_summary){
        	this.set('hourly_summary',hourly_summary)
        },
        get_hourly_summary: function(){
        	return this.get('hourly_summary');
        },
        set_month_summary: function(month_summary){
        	this.set('month_summary',month_summary);
        },
        get_month_summary: function(){
        	return this.get('month_summary');
        },
        set_six_month_summary: function(six_month_summary){
        	this.set('last_six_month_sale',six_month_summary);
        },
        get_six_month_summary: function(){
        	return this.get('last_six_month_sale');
        },
        set_customer_summary: function(customer_summary){
        	this.set('customer_summary',customer_summary);
        },
        get_customer_summary: function(){
        	return this.get('customer_summary');
        },
        set_top_product_result: function(top_products){
        	this.set('top_product',top_products);
        },
        get_top_product_result: function(){
        	return this.get('top_product');
        },
    });

	var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr,options){
        	_super_orderline.initialize.call(this, attr, options);
            this.line_note = '';
            this.oid = null;
            this.backorder = null;
            this.bag_color = false;
            this.is_bag = false;
            this.promotion = {};
            this.child_line_id = false;
            this.product_ids = false;
            this.buy_x_get_y_child_item = false;
            this.discount_line_id = false;
            this.discount_rule_name = false;
            this.quantity_discount = false;
            this.discount_amt_rule = false;
            this.discount_amt = false;
            this.multi_prods_line_id = false;
            this.is_rule_applied = false;
            this.combinational_product_rule = false;
            this.multi_prod_categ_rule = false;
            this.disc_above_price = false;
            this.set({
			    location_id: false,
			    location_name: false,
            });
            this.cancel_item = false;
            this.consider_qty = 0;
        },
        //Credit Management
        set_from_credit: function(from_credit) {
            this.from_credit = from_credit;
        },
        get_from_credit: function() {
            return this.from_credit;
        },
        set_cancel_item: function(val){
            this.set('cancel_item', val)
        },
        get_cancel_item: function(){
            return this.get('cancel_item');
        },
        set_consider_qty: function(val){
            this.set('consider_qty', val)
        },
        get_consider_qty: function(){
            return this.get('consider_qty');
        },
        set_location_id: function(location_id){
			this.set({
			    'location_id': location_id,
            });
		},
		set_cancel_process: function(oid) {
            this.set('cancel_process', oid)
        },
        get_cancel_process: function() {
            return this.get('cancel_process');
        },
        set_cancel_item_id: function(val) {
            this.set('cancel_item_id', val)
        },
        get_cancel_item_id: function() {
            return this.get('cancel_item_id');
        },
        set_line_status: function(val) {
            this.set('line_status', val)
        },
        get_line_status: function() {
            return this.get('line_status');
        },
		get_location_id: function(){
            return this.get('location_id');
		},
		set_location_name: function(location_name){
			this.set({
                'location_name': location_name,
            });
		},
		get_location_name: function(){
            return this.get('location_name');
		},
        set_quantity: function(quantity, keep_price){
            if(quantity === 'remove'){
                this.set_oid('');
                this.pos.get_order().remove_orderline(this);
                return;
            }else{
            	_super_orderline.set_quantity.call(this, quantity, keep_price);
            }
            this.trigger('change',this);
        },
        set_bag_color: function(bag_color) {
            this.bag_color = bag_color;
        },
        get_bag_color: function() {
            return this.get('bag_color');
        },
        set_is_bag: function(is_bag){
        	this.is_bag = is_bag;
        },
        get_is_bag: function(){
        	return this.is_bag;
        },
        set_line_note: function(line_note) {
            this.set('line_note', line_note);
        },
        get_line_note: function() {
            return this.get('line_note');
        },
        set_oid: function(oid) {
            this.set('oid', oid)
        },
        get_oid: function() {
            return this.get('oid');
        },
        set_back_order: function(backorder) {
            this.set('backorder', backorder);
        },
        get_back_order: function() {
            return this.get('backorder');
        },
        set_delivery_charges_color: function(delivery_charges_color) {
            this.delivery_charges_color = delivery_charges_color;
        },
        get_delivery_charges_color: function() {
            return this.get('delivery_charges_color');
        },
        set_deliver_info: function(deliver_info) {
            this.set('deliver_info', deliver_info);
        },
        get_deliver_info: function() {
          	return this.get('deliver_info');
        },
        set_delivery_charges_flag: function(delivery_charge_flag) {
            this.set('delivery_charge_flag',delivery_charge_flag);
        },
        get_delivery_charges_flag: function() {
            return this.get('delivery_charge_flag');
        },
        set_original_price: function(price){
			this.set('original_price', price)
		},
		get_original_price: function(){
			return this.get('original_price')
		},
		set_promotion_data: function(data){
        	this.promotion_data = data;
        },
        get_promotion_data: function(){
        	return this.promotion_data
        },
		init_from_JSON: function(json) {
			_super_orderline.init_from_JSON.apply(this, arguments)
			this.set_original_price(json.original_price);
		},
        export_as_JSON: function() {
            var lines = _super_orderline.export_as_JSON.call(this);
            var oid = this.get_oid();
            var return_process = oid;
            var return_qty = this.get_quantity();
            var order_ref = this.pos.get_order() ? this.pos.get_order().get_ret_o_id() : false;
            var default_stock_location = this.pos.config.stock_location_id ? this.pos.config.stock_location_id[0] : false;
            var serials = "Serial No(s).: ";
            var back_ser = "";
            var serials_lot = [];
            if(this.pack_lot_lines && this.pack_lot_lines.models){
                var self = this;
            	_.each(this.pack_lot_lines.models,function(lot) {
            		if(lot && lot.get('lot_name')){
        				if($.inArray(lot.get('lot_name'), serials_lot) == -1){
        					var count = 0;
        					serials_lot.push(lot.get('lot_name'));
        					_.each(self.pack_lot_lines.models,function(lot1) {
                        		if(lot1 && lot1.get('lot_name')){
                        			if(lot1.get('lot_name') == lot.get('lot_name')){
                        				count ++;
                        			}
                        		}
                            });
        					serials += lot.get('lot_name')+"("+count+")"+", ";
        				}
            		}
                });
            } else {
                serials = "";
            }
            this.lots = serials;
            var new_attr = {
                line_note: this.get_line_note(),
                cost_price: this.product.standard_price,
                return_process: return_process,
                return_qty: parseInt(return_qty),
                back_order: this.get_back_order(),
                deliver: this.get_deliver_info(),
                location_id: this.get_location_id() || default_stock_location,
                from_credit:this.get_from_credit(),
                //reservation
                cancel_item: this.get_cancel_item() || false,
                cancel_process: this.get_cancel_process() || false,
                cancel_qty: this.get_quantity() || false,
                consider_qty : this.get_consider_qty(),
                cancel_item_id: this.get_cancel_item_id() || false,
                new_line_status: this.get_line_status() || false,
                serial_nums: this.lots || false,
            }
            $.extend(lines, new_attr);
            return lines;
        },
        is_print_serial: function() {
        	var order = this.pos.get('selectedOrder');
        	return order.get_print_serial();
        },
        export_for_printing: function() {
            var lines = _super_orderline.export_for_printing.call(this);
            var order = this.pos.get('selectedOrder');
            lines.original_price = this.get_original_price() || false;
            var serials = "Serial No(s).: ";
            var serials_lot = [];
            var self = this;
            if(this.pack_lot_lines && this.pack_lot_lines.models){
            	_.each(this.pack_lot_lines.models,function(lot) {
            		if(lot && lot.get('lot_name')){
        				if($.inArray(lot.get('lot_name'), serials_lot) == -1){
        					var count = 0;
        					serials_lot.push(lot.get('lot_name'));
        					_.each(self.pack_lot_lines.models,function(lot1) {
                        		if(lot1 && lot1.get('lot_name')){
                        			if(lot1.get('lot_name') == lot.get('lot_name')){
                        				count ++;
                        			}
                        		}
                            });
        					serials += lot.get('lot_name')+"("+count+")"+", ";
        				}
            		}
                });
            } else { serials = "";}
            var new_attr = {
                line_note: this.get_line_note(),
                promotion_data: this.get_promotion_data() || false,
                serials: serials ? serials : false,
            	is_print: order.get_print_serial()
            }
            $.extend(lines, new_attr);
            return lines;
        },
        get_required_number_of_lots: function(){
            var lots_required = 1;
            lots_required = this.quantity;
            return lots_required;
        },
        can_be_merged_with: function(orderline){
            var merged_lines = _super_orderline.can_be_merged_with.call(this, orderline);
            if((this.get_quantity() < 0 || orderline.get_quantity() < 0)){
            	return false;
            } else if(!merged_lines){
            	if (!this.manual_price) {
            		if(this.get_location_id() !== this.pos.shop.id){
                		return false
                	}
            		if(this.get_promotion() && this.get_promotion().parent_product_id){
	            		return false;
	            	}else{
	            		return (this.get_product().id === orderline.get_product().id);
	            	}
	            } else {
	                return false;
	            }
            } else {
            	if(this.get_is_rule_applied()){
            		return false;
            	} else{
            		return merged_lines
            	}
            }
        },
        merge: function(orderline){
            if (this.get_oid()/* || this.pos.get_order().get_missing_mode()*/) {
                this.set_quantity(this.get_quantity() + orderline.get_quantity() * -1);
            } else {
                _super_orderline.merge.call(this, orderline);
            }
        },
        set_promotion: function(promotion) {
            this.set('promotion', promotion);
        },
        get_promotion: function() {
            return this.get('promotion');
        },
        set_child_line_id: function(child_line_id){
        	this.child_line_id = child_line_id;
        },
        get_child_line_id: function(){
        	return this.child_line_id;
        },
        set_buy_x_get_dis_y: function(product_ids){
        	this.product_ids = product_ids;
        },
        get_buy_x_get_dis_y: function(){
        	return this.product_ids;
        },
        set_buy_x_get_y_child_item: function(buy_x_get_y_child_item){
        	this.buy_x_get_y_child_item = buy_x_get_y_child_item;
        },
        get_buy_x_get_y_child_item: function(buy_x_get_y_child_item){
        	return this.buy_x_get_y_child_item;
        },
        set_discount_line_id: function(discount_line_id){
        	this.discount_line_id = discount_line_id;
        },
        get_discount_line_id: function(discount_line_id){
        	return this.discount_line_id;
        },
        set_quantity_discount: function(quantity_discount){
        	this.quantity_discount = quantity_discount;
        },
        get_quantity_discount: function(){
        	return this.quantity_discount;
        },
        set_discount_amt_rule: function(discount_amt_rule){
        	this.discount_amt_rule = discount_amt_rule;
        },
        get_discount_amt_rule: function(){
        	return this.discount_amt_rule;
        },
        set_discount_amt: function(discount_amt){
        	this.discount_amt = discount_amt;
        },
        get_discount_amt: function(){
        	return this.discount_amt;
        },
        get_discount_amt_str: function(){
        	return this.pos.chrome.format_currency(this.discount_amt);
        },
        set_multi_prods_line_id: function(multi_prods_line_id){
        	this.multi_prods_line_id = multi_prods_line_id;
        },
        get_multi_prods_line_id: function(){
        	return this.multi_prods_line_id;
        },
        set_is_rule_applied: function(is_rule_applied){
        	this.is_rule_applied = is_rule_applied;
        },
        get_is_rule_applied: function(){
        	return this.is_rule_applied;
        },
        set_combinational_product_rule: function(combinational_product_rule){
        	this.combinational_product_rule = combinational_product_rule;
        },
        get_combinational_product_rule: function(){
        	return this.combinational_product_rule;
        },
        set_multi_prod_categ_rule: function(multi_prod_categ_rule){
        	this.multi_prod_categ_rule = multi_prod_categ_rule;
        },
        get_multi_prod_categ_rule: function(){
        	return this.multi_prod_categ_rule;
        },
    });
    
    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
       initialize: function(attributes, options) {
           var self = this;
           _super_paymentline.initialize.apply(this, arguments);
           this.set({
        		   loyalty_point: 0,
        		   loyalty_amount: 0.00,
           });
        },
        set_loyalty_point: function(points){
        	this.set('loyalty_point', points)
        },
        get_loyalty_point: function(){
        	return this.get('loyalty_point')
        },
        set_loyalty_amount: function(amount){
        	this.set('loyalty_amount', amount)
        },
        get_loyalty_amount: function(){
        	return this.get('loyalty_amount')
        },
        set_freeze_line: function(freeze_line){
        	this.set('freeze_line', freeze_line)
        },
        get_freeze_line: function(){
        	return this.get('freeze_line')
        },
        set_giftcard_line_code: function(gift_card_code) {
            this.gift_card_code = gift_card_code;
        },
        get_giftcard_line_code: function(){
            return this.gift_card_code;
        },
        set_freeze: function(freeze) {
            this.freeze = freeze;
        },
        get_freeze: function(){
            return this.freeze;
        },
        set_gift_voucher_line_code: function(code) {
    		this.code = code;
    	},
    	get_gift_voucher_line_code: function(){
    		return this.code;
    	},
    	set_pid: function(pid) {
    		this.pid = pid;
    	},
    	get_pid: function(){
    		return this.pid;
    	},
    	set_payment_charge: function(val){
        	this.set('payment_charge',val);
        },
        get_payment_charge: function(val){
        	return this.get('payment_charge');
        },
    });

});