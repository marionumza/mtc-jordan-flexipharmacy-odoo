odoo.define('flexipharmacy.screens', function (require) {
	"use strict";

	var screens = require('point_of_sale.screens');
	var gui = require('point_of_sale.gui');
	var models = require('point_of_sale.models');
	var rpc = require('web.rpc');
	var core = require('web.core');

	var QWeb = core.qweb;
	var _t = core._t;

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
    	    	rpc.query(params, {async: false}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
                $('.freeze_screen').addClass("active_state");
                $(".unlock_button").fadeIn(2000);
                $('.unlock_button').show()
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

    screens.ActionpadWidget.include({
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.pay').unbind('click').click(function(){
                var order = self.pos.get_order();
                var partner = self.pos.get_order().get_client();
                var has_valid_product_lot = _.every(order.orderlines.models, function(line){
                    return line.has_valid_product_lot();
                });
                if(partner){
                    var params = {
                    model: 'account.invoice',
                    method: 'get_outstanding_info',
                    args: [partner.id]
                    }
                    rpc.query(params, {async: false}).then(function(res){
                        if(res){
                            partner['deposite_info'] = res;
                            _.each(res['content'], function(value){
                                  self.pos.amount = value['amount'];
                            });
                        }
                    });
                }
                if(!has_valid_product_lot){
                    self.gui.show_popup('confirm',{
                        'title': _t('Empty Serial/Lot Number'),
                        'body':  _t('One or more product(s) required serial/lot number.'),
                        confirm: function(){
                            self.gui.show_screen('payment');
                        },
                    });
                }else{
                    self.gui.show_screen('payment');
                }
            });
            this.$('.set-customer').click(function(){
                self.gui.show_screen('clientlist');
            });
        },
    });

	screens.ProductListWidget.include({
		init: function(parent, options) {
            var self = this;
            this._super(parent,options);
            this.model = options.model;
            this.productwidgets = [];
            this.weight = options.weight || 0;
            this.show_scale = options.show_scale || false;
            this.next_screen = options.next_screen || false;
            this.click_product_handler = function(e){
                var product = self.pos.db.get_product_by_id(this.dataset.productId);
                if(product){
                    if($(e.target).attr('class') === "product-qty-low" || $(e.target).attr('class') === "product-qty"){
                        var prod = product;
                        var prod_info = [];
                        var total_qty = 0;
                        rpc.query({
                            model: 'stock.warehouse',
                            method: 'disp_prod_stock',
                            args: [
                                 prod.id,self.pos.shop.id
                            ]
                        }).then(function(result){
                        if(result){
                            prod_info = [];
                            total_qty = 0;
                            _.each(result[0],function(item){
                            	if(item[2] != self.pos.config.stock_location_id[0] && item[1] > 0){
                            		prod_info.push(item)
                            		total_qty += item[1]
                            	}
                            });
                            if(total_qty > 0){
                            	 $("[data-product-id='"+product.id+"']").find('.total_qty').html(product.qty_available)
                                 self.gui.show_popup('product_qty_advance_popup',{prod_info_data:prod_info,total_qty: total_qty,product: product});
                            }
                        }
                        }).fail(function (error, event){
                            if(error.code === -32098) {
                            	self.pos.db.notification('danger',_t("Server Down..."));
                                event.preventDefault();
                           }
                        });
                    }else{
                        options.click_product_action(product);
                    }
                }
            };
            this.product_list = options.product_list || [];
            this.product_cache = new screens.DomCache();
        },
		renderElement: function() {
			var self = this;
			var order = self.pos.get_order();
			var product_list = [];
			_.each(this.product_list,function(prd){
				if(order && order.is_sale_product(prd)){
					product_list.push(prd)
				}
			});
			this.product_list = product_list;
			this._super();
		},
		set_product_list: function(product_list){
    		var self = this;
    		var new_product_list = [];
    		var ignore_product_list = [];
    		var order = self.pos.get_order();
    		var dummy_product_ids = self.pos.db.get_dummy_product_ids();
    		if(product_list.length > 0){
    			product_list.map(function(product){
    				if(($.inArray(product.id, dummy_product_ids) == -1) && (!product.is_dummy_product)){
    					new_product_list.push(product);
    				}
    			});
    		}
            this.product_list = new_product_list;
            this.renderElement();
        },
	});
//  Load Background
    screens.ProductCategoriesWidget.include({
    	init: function(parent, options){
    		var self = this;
            this._super(parent,options);
            this.clear_category_search_handler = function(event){
            	self.clear_cat_search();
            };
            
            this.clear_brand_search_handler = function(event){
            	self.clear_brand_search();
            };
            if(!self.pos.load_background){
            	return
            }
            var data = {
        			'config_id': self.pos.config.id,
                    'product_domain': self.pos.product_domain,
                    'product_fields': self.pos.product_fields,
                    'compute_user_id': self.pos.user.id
                    }
            var records = rpc.query({
                model: 'product.product',
                method: 'calculate_product',
                args: [self.pos.config.id],
            }).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
            records.then(function(result){
            	$('div.product_progress_bar').css('display','');
            	$('#product_sync').hide();
            	if(result && result[0]){
            		var product_ids = result;
			    	var total_products = product_ids.length;
			    	var remaining_time;
			    	if(total_products){
			    		var product_limit = 1000;
			    		var count_loop = product_ids.length;
			    		var last_ids = product_ids;
			    		var count_loaded_products = 0;
			    		var context = _.extend(self.pos.product_context, {
		    	            'location': self.pos.config.stock_location_id[0],
		    	        })
			    		function ajax_product_load(){
			    			if(count_loop > 0){
			    				$.ajax({
					                type: "GET",
						            url: '/web/dataset/load_products',
						            data: {
						                    model: 'product.product',
						                    fields: JSON.stringify(self.pos.product_fields),
//						                    domain: JSON.stringify(self.pos.product_domain),
//						                    context: JSON.stringify(context),
						                    product_limit:product_limit,
						                    product_ids:JSON.stringify(last_ids.splice(0, product_limit) || []),
						                },
						            success: function(res) {
						            	var all_products = JSON.parse(res);
					            		count_loop -= all_products.length;
					            		remaining_time = ((total_products - count_loop) / total_products) * 100;
//						            	product_limit += 1000;
						            	var filter_product_ids = [];
                                        all_products.map(function(product){
                                            self.pos.product_list.push(product);
                                        });
						                self.pos.db.add_products(_.map(all_products, function (product) {
						                    product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
						                    return new models.Product({}, product);
						                }));
						                self.renderElement();
						                if(remaining_time > 100)
						                	remaining_time = 100;
						                $('.product_progress_bar').css('display','');
					            		$('.product_progress_bar').find('#bar').css('width', parseInt(remaining_time)+'%', 'important');
					            		$('.product_progress_bar').find('#progress_status').html(parseInt(remaining_time) + "% completed");
					            		count_loaded_products += all_products.length;
                                        all_products = [];
					            		if(count_loaded_products >= total_products){
					            			self.pos.load_background = true;
					            			$('.product_progress_bar').delay(3000).fadeOut('slow');
					            		}
						                ajax_product_load();
						            },
						            error: function() {
						                $('.product_progress_bar').find('#bar').css('width', '100%', 'important');
					            		$('.product_progress_bar').find('#progress_status').html("Products loading failed...");
						            },
					            });
			    			} else {
			    				$('#product_sync').show();
			    				self.pos.load_background = true;
			    	            var prod = self.pos.db.get_product_by_category(0);
			    	            //DO FIX: call it background
			    				var records = rpc.query({
			    	                model: 'pos.config',
			    	                method: 'store_data_to_cache',
			    	                args: [[data],prod],	
			    	            }).fail(function(){
			                    	self.pos.db.notification('danger',"Connection lost");
			                    });
			    			}
			    		}
			    		ajax_product_load();
			    	}
			    }
            });
    	},
    	renderElement: function(){
    		this._super();
    		var self = this;
    		self.el.querySelector('.category_home').addEventListener('click',function(){
                var cat = self.pos.db.get_category_by_id(self.pos.db.root_category_id);
                self.set_category(cat);
			    var sub_categories = self.subcategories;
			    var products = self.gui.screen_instances.products;
			    if(products){
			        products.parent_categ_id = self.pos.db.root_category_id;
                    products.render_product_category(sub_categories);
                    products.product_categories_widget.renderElement();
			    }
                self.renderElement();
            });
            self.el.querySelector('.product_home_listview').addEventListener('click',function(){
                if($(this).hasClass('selected_list')){
                    $(this).removeClass('selected_list');
                    $('.product-list-view').hide();
                    $('.product-list').show();
                }else{
                    $(this).addClass('selected_list');
                    $('.product-list').hide();
                    $('.product-list-view').show();
                    var product;
                    var allow_product = [];
                    var products = self.pos.db.get_product_by_category(0);
                    for(var i = 0, len = products.length; i < len; i++){
                        product = products[i];
                        if(!product.is_dummy_product){
                            allow_product.push(product)
                        }
                    }
                    if(allow_product.length > 0){
                        $('.home_product_list_manage').html(QWeb.render('HomeProductList',{widget: self,products: allow_product}));
                    }
                }
            });
            //Category search
    		$('.category_searchbox input', this.el).keyup(function(e){
    			if($(this).val() == ""){
                    var cat = self.pos.db.get_category_by_id(self.pos.db.root_category_id);
                    self.set_category(cat);
                 }
                $('.category_searchbox input').autocomplete({
                     source:self.pos.db.get_category_search_list(),
                     select: function(event, select_category){
                    	 if(select_category.item && select_category.item.id){
                         	 var cat = self.pos.db.get_category_by_id(select_category.item.id);
                             self.set_category(cat);
                             self.renderElement();
                             var input = $('.category_searchbox input');
                             input.val(select_category.item.label);
                 		     input.focus();
                         }
                     },
                });
    			e.stopPropagation();
            });
    		$('.category_searchbox input', this.el).keypress(function(e){
                $('.category_searchbox input').autocomplete({
                    source:self.pos.db.get_category_search_list(),
                    select: function(event, select_category){
                    	if(select_category.item && select_category.item.id){
                        	var cat = self.pos.db.get_category_by_id(select_category.item.id);
                            self.set_category(cat);
                            self.renderElement();
                            input.val(select_category.item.label);
                			var input = $('.category_searchbox input');
                		    input.focus();
                        }
                    },
                });
                e.stopPropagation();
            });
//            //brand Search
            $('.barnd_searchbox input', this.el).keyup(function(e){
    			 if($(this).val() == ""){
                    var cat = self.pos.db.get_category_by_id(self.pos.db.root_category_id);
                    self.set_category(cat);
                 }
    			 $('.brand_searchbox input').autocomplete({
                     source:self.pos.db.get_barnds_search_list(),
                     select: function(event, select_brand){
                    	 if(select_brand.item && select_brand.item.id){
                         	var products = self.pos.db.get_products_by_brand_id(select_brand.item.id);
                         	self.product_list_widget.set_product_list(products);
                             var input = $('.barnd_searchbox input');
                             input.val(select_brand.item.label);
                 		     input.focus();
                         }
                     },
                 });
    			e.stopPropagation();
            });
    		$('.brand_searchbox input', this.el).keypress(function(e){
                $('.brand_searchbox input').autocomplete({
                    source:self.pos.db.get_barnds_search_list(),
                    select: function(event, select_brand){
                    	if(select_brand.item && select_brand.item.id){
                        	var products = self.pos.db.get_products_by_brand_id(select_brand.item.id);
                        	self.product_list_widget.set_product_list(products);
                            var input = $('.barnd_searchbox input');
                            input.val(select_brand.item.label);
                		    input.focus();
                        }
                    },
                });
                e.stopPropagation();
            });
    		this.el.querySelector('.category-clear').addEventListener('click',this.clear_category_search_handler);
    		this.el.querySelector('.brand-clear').addEventListener('click',this.clear_brand_search_handler);
    	},
    	clear_cat_search: function(){
			var self = this;
			this.set_category(this.pos.db.get_category_by_id(this.start_categ_id));
			self.renderElement();
			var input = $('.category_searchbox input');
		    input.val('');
		    input.focus();
		},
    	clear_brand_search: function(){
			var self = this;
			this.set_category(this.pos.db.get_category_by_id(0));
			self.renderElement();
			var input = $('.brand_searchbox input');
		    input.val('');
		    input.focus();
		},
    });

	var LoginScreenWidget = screens.ScreenWidget.extend({
	    template: 'LoginScreenWidget',
	    init: function(parent, options){
	    	var self = this;
	        this._super(parent, options);
	    },
	    start: function(){
	        var self = this;
	        this._super();
	        $("input#username").focus();
	        var selected_input;
	        if ($("#login").is(":focus")) {
	            selected_input = $("#login");
	        }
	        if ($("#password").is(":focus")) {
	            selected_input = $("#password");
	        }
	        $("input").focus(function() {
	            selected_input = $(this);
	        });
	        $('.number_pad_button').click(function() {
	            var pres_char = $(this).html();
	            if ($(this).hasClass("ac-clear-data")) {
	                selected_input.val("");
	            } else if ($(this).hasClass("back-button")) {
	                selected_input.val(selected_input.val().slice(0, -1));
	            } else if ($(this).hasClass("ac-submit-button")) {

	            } else if ($(this).hasClass("login_space")) {
	            	if(selected_input){
	            		selected_input.val(selected_input.val() + " ");
	            	}
	            } else {
	            	if(selected_input){
	            		selected_input.val(selected_input.val() + "" + pres_char);	
	            	}
	            }
	        });
	        $(".change_char").click(function() {
	            $(".is_numpad").addClass("display_none");
	            $(".is_charpad").removeClass("display_none");
	            $(".is_smallcharpad").addClass("display_none")
	            $(".change_num").removeClass("display_none");
	            $(".change_char").addClass("display_none");
	            $(".change_smallChar").removeClass("display_none");
	        });
	        $(".change_num").click(function() {
	            $(".is_numpad").removeClass("display_none");
	            $(".is_charpad").addClass("display_none");
	            $(".is_smallcharpad").addClass("display_none")
	            $(".change_num").addClass("display_none")
	            $(".change_smallChar").addClass("display_none");
	            $(".change_char").removeClass("display_none");
	        });
	        $(".change_smallChar").click(function() {
	            if ($(".is_smallcharpad").hasClass("display_none")) {
	                $(".is_numpad").addClass("display_none");
	                $(".is_charpad").addClass("display_none");
	                $(".is_smallcharpad").removeClass("display_none");
	                $(".change_smallChar").removeClass("display_none");
	            } else {
	                $(".is_charpad").removeClass("display_none");
	                $(".is_smallcharpad").addClass("display_none");
	            }
	        });
	        $('input#password, input#username').keypress(function(e){
	        	if(e.keyCode == 13){
	        		var username = $("input#username").val();
			        var password = $("input#password").val();
			        if(username && password){
			        	self.login_user(username, password);
			        }else{
			        	self.pos.db.notification('danger',_t('Please enter username and password'));
			        }
	        	}
	        });
	        $('#login').click(function(){
	        	var username = $("input#username").val();
		        var password = $("input#password").val();
		        if(username && password){
		        	self.login_user(username, password);
		        }else{
		        	self.pos.db.notification('danger',_t('Please enter username and password'));
		        }
	        });
	        $('.pos-login-rightheader').click(function(){
	        	self.pos.gui.close();
	        });
	    },
	    login_user: function(username, password){
	    	var self = this;
	    	var user = _.find(self.pos.users, function(obj) { return obj.login == username && obj.pos_security_pin == password });
        	if(user){
        		$('.pos-topheader').show();
            	self.pos.set_cashier(user);
            	$('.pos-login-topheader').hide();
            	self.chrome.widget.username.renderElement();
            	if(self.pos.pos_session.opening_balance){
            		return self.gui.show_screen('openingbalancescreen');
            	}
                self.gui.show_screen("products");
            	self.pos.chrome.slider_widget.renderElement();
            	self.pos.set_login_from('login');
            	if(self.pos.get_locked_screen()){
            		self.gui.show_screen(self.pos.get_locked_screen());
            	}else{
            		self.gui.set_default_screen('products');
            	}
            	self.pos.set_locked_screen(false);
            	self.pos.set_locked_user(false);
            	if($('.show-left-cart').css('display') == 'block'){
            		$('.show-left-cart').hide();
            	}
            	self.pos.chrome.screens.products.order_widget.update_summary();
            	var params = {
    	    		model: 'pos.session',
    	    		method: 'write',
    	    		args: [self.pos.pos_session.id,{'is_lock_screen' : false}],
    	    	}
            	rpc.query(params, {async: false}).then(function(result){
            		if(result){
            			 $('.lock_button').css('background-color', '#eee');
            		}
            	}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
            	if(self.pos.config.enable_automatic_lock && self.pos.get_cashier().access_pos_lock){
            		start_lock_timer(self.pos.config.time_interval, self);
            	}
            }else{
            	self.pos.db.notification('danger',_t('Invalid Username or Pin!!!'));
            }
	    },
	    show: function(){
	    	var self = this;
	    	this._super();
	    	$("input#password").val('');
	    	$('.pos-topheader').hide();
	    	$("input#username").focus();
	    	$('.pos-login-topheader').show();
	    	if(self.pos.get_locked_user()){
	    		$("input#username").val(self.pos.get_locked_user());
	    		$("input#password").focus();
	    	}else{
	    		$("input#username").val('');
	    	}
	    },
	    close: function(){
	        var self = this;
	    	this._super();
	    },
    });
	gui.define_screen({name:'login', widget: LoginScreenWidget});

	screens.ClientListScreenWidget.include({
		show: function(){
			var self = this;
			self._super();
			
			
			this.selected_partner = false;
			var partner = self.pos.partners;
			var order = self.pos.get_order();
			if(order.get_client()){
				self.display_client_details('show',order.get_client(),0);
			} else{
				self.display_client_details('show',partner[0],0);
			}
			
			var $show_customers = $('#show_customers');
            var $show_client_history = $('#show_client_history');
            if (this.pos.get_order().get_client() || this.new_client) {
                $show_client_history.removeClass('oe_hidden');
            }
            $show_customers.off().on('click', function(e){
                $('.client-list').removeClass('oe_hidden');
                $('#customer_history').addClass('oe_hidden')
                $show_customers.addClass('oe_hidden');
                $show_client_history.removeClass('oe_hidden');
            })
			
			$('#globe_cust').click(function() {
				if(self.selected_partner){
					self.pos.gui.show_popup('map_popup',{'partner':self.selected_partner})
				}
			});
		},
        toggle_save_button: function(){
            var self = this;
            this._super();
            var $show_customers = this.$('#show_customers');
            var $show_client_history = this.$('#show_client_history');
            var $customer_history = this.$('#customer_history');
            var client = this.new_client || this.pos.get_order().get_client();
            if (this.editing_client) {
                $show_customers.addClass('oe_hidden');
                $show_client_history.addClass('oe_hidden');
            } else {
                if(client){
                    $show_client_history.removeClass('oe_hidden');
                    $show_client_history.off().on('click', function(e){
                        self.render_client_history(client);
                        $('.client-list').addClass('oe_hidden');
                        $customer_history.removeClass('oe_hidden');
                        $show_client_history.addClass('oe_hidden');
                        $show_customers.removeClass('oe_hidden');
                    });
                } else {
                    $show_client_history.addClass('oe_hidden');
                    $show_client_history.off();
                }
            }
            var $credit_button = this.$('.button.credit');
            if (this.editing_client) {
                $credit_button.addClass('oe_hidden');
                return;
            } else if( this.new_client ){
                if( !this.old_client){
                    $credit_button.text(_t('Credit History'));
                }else{
                    $credit_button.text(_t('Credit History'));
                }
            }else{
                $credit_button.text(_t('Credit History'));
            }
            $credit_button.toggleClass('oe_hidden',!this.has_client_changed());


            var $add_money_button = this.$('.button.add-money-button');
            if (this.editing_client) {
                $add_money_button.addClass('oe_hidden');
                return;
            } else if( this.new_client ){
                if( !this.old_client){
                    $add_money_button.text(_t('Add Credit'));
                }else{
                    $add_money_button.text(_t('Add Credit'));
                }
            }else{
                $add_money_button.text(_t('Add Credit'));
            }
            $add_money_button.toggleClass('oe_hidden',!this.has_client_changed());
        },
        saved_client_details: function(partner_id){
            var self = this;
            var params = {
                            model: 'res.partner',
                            method: 'search_read',
                            domain: [['id', '=', partner_id]],
                         }
            rpc.query(params, {async: false}).then(function(partner){
                self.render_list(self.pos.db.get_partners_sorted(1000));
                // update the currently assigned client if it has been changed in db.
                var curr_client = self.pos.get_order().get_client();
                if (curr_client) {
                    self.pos.get_order().set_client(self.pos.db.get_partner_by_id(curr_client.id));
                }
                if (partner) {
                    self.new_client = partner[0];
                    self.pos.db.add_partners(partner);
                    self.toggle_save_button();
                    self.display_client_details('show',partner[0]);
                } else {
                    // should never happen, because create_from_ui must return the id of the partner it
                    // has created, and reload_partner() must have loaded the newly created partner.
                    self.display_client_details('hide');
                }
            });
        },
        _get_customer_history: function(partner){
        	var params = {
        		model: 'pos.order',
        		method: 'search_read',
        		domain: [['partner_id', '=', partner.id]],
        	}
        	rpc.query(params, {async: false})
//            new Model('pos.order').call('search_read', [[['partner_id', '=', partner.id]]], {}, {async: false})
            .then(function(orders){
                if(orders){
                     var filtered_orders = orders.filter(function(o){return (o.amount_total - o.amount_paid) > 0})
                     partner['history'] = filtered_orders
                }

            })
        },
        render_client_history: function(partner){
            var self = this;
            var contents = this.$el[0].querySelector('#client_history_contents');
            contents.innerHTML = "";
            self._get_customer_history(partner);
            if(partner.history){
                for (var i=0; i < partner.history.length; i++){
                    var history = partner.history[i];
                    var history_line_html = QWeb.render('ClientHistoryLine', {
                        partner: partner,
                        order: history,
                        widget: self,
                    });
                    var history_line = document.createElement('tbody');
                    history_line.innerHTML = history_line_html;
                    history_line = history_line.childNodes[1];
                    history_line.addEventListener('click', function(e){
                        var order_id = $(this).data('id');
                        if(order_id){
                            var previous = self.pos.get_order().get_screen_data('previous-screen');
                            self.gui.show_screen('orderdetail', {
                                order_id: order_id,
                                previous: previous,
                                partner_id: partner.id
                            });
                        }
                    })
                    contents.appendChild(history_line);
                }
            }
        },
        render_payment_history: function(){
            var self = this;
            var $client_details_box = $('.client-details-box');
            $client_details_box.addClass('oe_hidden');
        },
		display_client_details: function(visibility,partner,clickpos){
			var self = this;
			if(visibility == 'hide'){
				return
			}
			self._super(visibility,partner,clickpos);
			self.selected_partner = partner;
			$("#map_search").val('')
			if(navigator.onLine){
				initMap();
				if(partner){
					codeAddress(partner.address);
				} 
			} else{
				self.pos.db.notification('danger','Check Internet Connection!');
			}
			$('#map_search_clear_box').click(function() {
				$('#map_search').val('');
				if(navigator.onLine){
					codeAddress(partner.address);
				}
			});
			$("#map_search").focus(function() {
				if(navigator.onLine){
					geolocate();
				}
			});
			if(visibility == "edit"){
				var system_parameters = self.pos.system_parameters;
				if(system_parameters && system_parameters[0]){
					system_parameters.map(function(system_parameter){
						if(system_parameter.key == 'google_api_key' && system_parameter.value){
							$("input.detail.client-name").focus(function() {
								if(navigator.onLine){
									geolocate();
								}
							});
							$("input.detail.client-address-street").focus(function() {
								if(navigator.onLine){
									geolocate();
								}
							});
							$("input.detail.client-address-city").focus(function() {
								if(navigator.onLine){
									geolocate();
								}
							});
							$("input.detail.client-address-zip").focus(function() {
								if(navigator.onLine){
									geolocate();
								}
							});
						}
					});
				}
			}
		},
	    save_changes: function(){
            this._super();
             if (this.pos.config.enable_ereceipt && this.pos.get_cashier().access_ereceipt && this.has_client_changed()) {
                var prefer_ereceipt = this.new_client ? this.new_client.prefer_ereceipt : false;
                var customer_email = this.new_client ? this.new_client.email : false;
                if (prefer_ereceipt) {
                    $('#is_ereciept')[0].checked = true;
                    $('#email_id').show();
                    $('#update_email_tr').show();
                    if(customer_email) {
                        $('#email_id').val(customer_email);
                    };
                } else {
                    $('#is_ereciept')[0].checked = false;
                    $('#email_id').hide();
                    $('#update_email_tr').hide();
                    $('#email_id').val('');
                }
            }
        },
    });

	var ProductsScreenWidget = screens.ScreenWidget.extend({
        template: 'ProductsScreenWidget',
        init: function(parent, options){
            var self = this;
            this._super(parent, options);
            this.category = 0;
            self.product_click = function(){
            	var prodict_id = $(this).data('product-id');
            	if(prodict_id){
            		var product = self.pos.db.get_product_by_id(prodict_id);
            		if(product){
            			self.gui.show_popup('show_product_popup',{'product':product});
            		}
            	}
            };
            this.clear_search_handler = function(event){
                self.clear_search();
                var input = $('.searchbox input');
            	input.val('');
                input.focus();
            };
            var search_timeout  = null;
            self.namelist = [];
    		_.each(self.pos.db.get_product_namelist(),function(list){
    			if(list[0] !== self.pos.config.delivery_product_id[0]){
    				self.namelist.push(list[1]);
    			}
    		});
            this.search_handler = function(event){
            	$(this).autocomplete({
                    source:self.namelist,
            	});
            	
            	var searchbox = this;
                if(event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8){
                    clearTimeout(search_timeout);
                    search_timeout = setTimeout(function(){
                        self.perform_search(self.category, searchbox.value, event.which === 13);
                    },70);
                }
            };
        },
        events: {
	    	'click .button.back':'click_back',
	    	'click .button.btn_kanban':'click_kanban',
	    	'click .button.btn_list':'click_list',
	    	'click .button.btn_add_product': 'create_product',
	    },
        filter:"all",
        date: "all",
        click_back: function(){
        	this.gui.show_screen('products');
        },
        start: function(){
        	var self = this;
        	self._super();
        	this.$('.ac_product_list_manage').delegate('.main-product','click',self.product_click);
        },
        render_products: function(products){
        	$('.product_list_manage').html(QWeb.render('ProductList',{
            	widget: this,
            	products: products}));
        },
        show: function(){
        	var self = this;
            this._super();
            var all_products = this.pos.db.get_product_by_category(0)
            $('.brand_searchbox input').val('');
            $('.category_searchbox input').val('');
            $('.searchbox input').val('');
            $('.searchbox input').focus();
            $('span.category-clear_manage').click(function(e){
            	self.clear_search();
            	var input = $('.category_searchbox input');
	            input.val('');
	            input.focus();
	            
            });
            $('span.brand-clear_manage').click(function(e){
            	self.clear_search();
            	var input = $('.brand_searchbox input');
            	input.val('');
                input.focus();
            });
            this.render_products(all_products);
        },
        renderElement: function(){
        	var self = this;
        	self._super();
        	this.el.querySelector('.searchbox input').addEventListener('keypress',this.search_handler);

            this.el.querySelector('.searchbox input').addEventListener('keydown',this.search_handler);

            this.el.querySelector('.search-clear').addEventListener('click',this.clear_search_handler);

            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect($(this.el.querySelector('.searchbox input')));
            }
            
            $('.category_searchbox input', this.el).keyup(function(e){
    			if($(this).val() == ""){
                    var cat = self.pos.db.get_product_by_category(self.pos.db.root_category_id);
                    self.render_products(cat);
                }
                 $('.category_searchbox input').autocomplete({
                     source:self.pos.db.get_category_search_list(),
                     select: function(event, select_category){
                    	 if(select_category.item && select_category.item.id){
                         	var cat = self.pos.db.get_product_by_category(select_category.item.id);
                         	 self.render_products(cat);
                             var input = $('.category_searchbox input');
                             input.val(select_category.item.label);
                 		     input.focus();
                         }
                     },
                 });
    			e.stopPropagation();
            });
    		$('.category_searchbox input', this.el).keypress(function(e){
                $('.category_searchbox input').autocomplete({
                    source:self.pos.db.get_category_search_list(),
                    select: function(event, select_category){
                    	if(select_category.item && select_category.item.id){
                        	var cat = self.pos.db.get_product_by_category(select_category.item.id);
                        	self.render_products(cat);
                        	var input = $('.category_searchbox input');
                            input.val(select_category.item.label);
                		    input.focus();
                        }
                    },
                });
                e.stopPropagation();
            });
           
            //brand search
            $('.brand_searchbox input', this.el).keyup(function(e){
    			if($(this).val() == ""){
                    var cat = self.pos.db.get_product_by_category(self.pos.db.root_category_id);
                    self.render_products(cat);
                }
                 $('.brand_searchbox input').autocomplete({
                	 source:self.pos.db.get_barnds_search_list(),
                     select: function(event, select_brand){
                     	if(select_brand.item && select_brand.item.id){
                            var products = self.pos.db.get_products_by_brand_id(select_brand.item.id);
                         	self.render_products(products);
                         	var input = $('.brand_searchbox input');
                         	input.val(select_brand.item.label);
                 		    input.focus();
                         }
                     },
                 });
    			e.stopPropagation();
            });
    		$('.brand_searchbox input', this.el).keypress(function(e){
                $('.brand_searchbox input').autocomplete({
                	source:self.pos.db.get_barnds_search_list(),
                    select: function(event, select_brand){
                    	if(select_brand.item && select_brand.item.id){
                            var products = self.pos.db.get_products_by_brand_id(select_brand.item.id);
                        	self.render_products(products);
                        	var input = $('.brand_searchbox input');
                            input.val(select_brand.item.label);
                		    input.focus();
                        }
                    },
                });
                e.stopPropagation();
            });
        },
     // empties the content of the search box
        clear_search: function(){
            var products = this.pos.db.get_product_by_category(0);
            this.render_products(products);
        },
        perform_search: function(category, query, buy_result){
            var products = this.pos.db.get_product_by_category(category);
            if(query){
            	products = this.pos.db.search_product(query);
            }
            this.render_products(products);
        },
        click_kanban: function(event){
        	$(event.currentTarget).addClass('highlight')
        	$('.btn_list').removeClass('highlight')
        	$('.ac_product_list_manage').removeClass('list');
        },
        click_list: function(event){
        	$('.ac_product_list_manage').addClass('list');
        	$(event.currentTarget).addClass('highlight')
        	$('.btn_kanban').removeClass('highlight')
        },
        create_product: function(){
        	var self = this;
        	self.gui.show_popup('create_product_popup');
        },
    });
    gui.define_screen({name:'product-screen', widget: ProductsScreenWidget});

    screens.PaymentScreenWidget.include({
    	events: _.extend({}, screens.PaymentScreenWidget.prototype.events, {
			'click .js_gift_voucher': 'click_gift_voucher',
			'click .credit_assign':'credit_assign',
			'click #pos-debit': 'pos_debit',
		}),
		// Debit Management
		pos_debit: function(e){
			var order = self.pos.get_order();
        	if(order.is_empty()){
        		self.pos.db.notification('danger',_t('Add product(s) in cart!'));
        		return
        	}
        	if (!order.get_client()){
        		self.pos.db.notification('danger',_t('Please select customer!'));
        		self.pos.gui.show_screen('clientlist')
        		return
        	}
        	if(order.get_ret_o_id()){
        		self.pos.db.notification('danger',_t('Sorry, This operation not allow to create draft order!'));
        		return
        	}
        	order.set_is_debit(true);
        	order.set_delivery(true)
            var currentOrderLines = order.get_orderlines();
            var orderLines = [];
            _.each(currentOrderLines,function(item) {
                return orderLines.push(item.export_as_JSON());
            });
        	var debit = order.get_total_with_tax() - order.get_total_paid();
     		var client = order.get_client();
        	if (client && debit > client.remaining_debit_amount){
     			self.gui.show_popup('max_limit',{
     				remaining_debit_limit: client.remaining_debit_amount,
                    draft_order: true,
                });
                return
     	    } else {
     	    	self.pos.push_order(order);
                self.gui.show_screen('receipt');
            }
		},
		//Credit Management
		credit_assign: function(e){
            $(".account_payment_btn").html("");
	        var self = this;
	        var order = self.pos.get_order();
	        var partner = order.get_client();
	        var add_class = false;
            if($(e.currentTarget).hasClass('account_pay')){
                add_class = false;
                $(e.currentTarget).removeClass('account_pay');
                var lines = self.pos.get_order().get_orderlines()
                var new_amount = Number($(e.currentTarget).attr('use_amt'));
                var order_amount = order.get_total_with_tax();
                var to_be_remove = false
                var credit_detail = order.get_credit_detail();
                var journal_id = Number($(e.currentTarget).attr('journal_id'));
                for (var i=0;i<lines.length;i++){
                	if(lines[i].product.id == self.pos.config.prod_for_payment[0]){
                		for (var j=0;j<credit_detail.length;j++){
                			if(lines[i].price == (-credit_detail[j].amount)){
                    			to_be_remove = lines[i].id
                    			break
                    		}
                		}
                	}
                }
                for(var i=0;i<credit_detail.length;i++){
                	if(credit_detail[i].journal_id == journal_id){
                		credit_detail.splice(i, 1);
                	}
                }
                 if(order.get_orderline(to_be_remove)){
                     order.remove_orderline(order.get_orderline(to_be_remove));
                 }
                var pos_total_amount = 0.00
                var order_details =  order.get_credit_detail()
                 _.each(order_details,function(order_detail) {
                    pos_total_amount += order_detail.amount
                });
                 self.pos.credit_amount = pos_total_amount;
                 var tabs = QWeb.render('FromCredit',{widget:self});
                 $('.foreign_infoline').html(tabs);
            }else{
                $(e.currentTarget).addClass('account_pay');
                var journal = $(e.currentTarget).attr('journal');
                var journal_id = Number($(e.currentTarget).attr('journal_id'));
                var amount = Number($(e.currentTarget).attr('amt'));
                var order_amount = order.get_total_with_tax();
                var prd = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                var lines = self.pos.get_order().get_orderlines()
                self.pos.credit = true;
                self.pos.cmp_journal_id = journal_id;
                if(prd && order_amount != 0.00){
                      if(order_amount < amount){
                        var paid_amt =  order_amount;
                      } else{
                            var paid_amt = amount;
                      }
//                      if(lines.length > 0){
//                    	  _.each(lines,function(line){
//                    		  if(line.product.id == prd.id){
//                    			  order.remove_orderline(line)
//                    		  }
//                    	  });
//                      }
                      order.add_product(prd,{'price':-paid_amt});
                      $(e.currentTarget).attr('use-amt',-paid_amt);
                       var select_line = order.get_selected_orderline();
                       if(select_line){
                            select_line.set_from_credit(true);
                            var credit_info = {
                                'partner_id':partner.id,
                                'amount':paid_amt,
                                'journal':journal,
                                'journal_id':journal_id
                            }
                            order.set_credit_detail(credit_info);
                       }
                }
                var pos_total_amount = 0.00
                var order_details =  order.get_credit_detail();
                _.each(order_details,function(order_detail) {
                    pos_total_amount += order_detail.amount
                });
                self.pos.credit_amount = pos_total_amount;
                var tabs = QWeb.render('FromCredit',{widget:self});
                this.$('.foreign_infoline').html(tabs);
            }
            var p_line = order.get_paymentlines();
	        if(p_line.length > 0){
	        	self.pos.gui.screen_instances.payment.render_paymentlines()
	        }
	    },
    	init: function(parent, options) {
            var self = this;
            this._super(parent, options);
            this.div_btns = "";
            var payment_buttons = this.pos.config.payment_buttons;
            for(var i in payment_buttons){
            	var btn_info = this.pos.db.get_button_by_id(payment_buttons[i]);
            	this.div_btns += "<div id="+btn_info.id+" class='control-button 1quickpay' data="+btn_info.display_name+">"+self.format_currency(btn_info.display_name)+"</div>"
            }
            this.use_credit = function(event){
                var order = self.pos.get_order();
                if(order.get_due() <= 0){
                    return;
                }
                order.set_use_credit(!order.get_use_credit());
                if (order.get_use_credit()) {
                    if(order.get_client()){
                        var params = {
                            model: "res.partner",
                            method: "search_read",
                            domain: [['id', '=', order.get_client().id]],
                            fields:['remaining_credit_amount']
                        }
                        rpc.query(params, {async: false})
                        .then(function(results){
                            if(results && results[0]){
                            	if(results[0].remaining_credit_amount <= 0){
                            		return
                            	}
                            	$('div.js_use_credit').addClass('highlight');
                            	var result = results[0];
                                var price = 0;
                                if(order.get_total_with_tax() < result.remaining_credit_amount){
                                    var rem = self.pos.get_order().get_due();
                                    price = rem || order.get_total_with_tax() * -1;
                                    order.set_type_for_credit('return');
                                    self.click_paymentmethods_by_journal(self.pos.config.pos_journal_id[0]);
                                }else if(order.get_total_with_tax() >= result.remaining_credit_amount){
                                    order.set_type_for_credit('change');
                                    var rem_due = self.pos.get_order().get_due();
                                    self.click_paymentmethods_by_journal(self.pos.config.pos_journal_id[0]);
                                    price = Math.min(rem_due,Math.abs(result.remaining_credit_amount * -1));
                                }else{
                                    order.set_type_for_credit('change');
                                }
                                self.renderElement();
                            }
                        });
                    }else {
                        alert(_t('Please select a customer to use Credit !'));
                    }
                }else {
                    $('.js_use_add_paymentlinecredit').removeClass('highlight');
                    self.renderElement();
                }
    	    };
            this.keyboard_handler = function(event){
                var key = '';
                if (event.type === "keypress") {
                    if (event.keyCode === 13 && self.pos.get_login_from() != 'login') { // Enter
                    	self.validate_order();
                    } else if ( event.keyCode === 190 || // Dot
                                event.keyCode === 110 ||  // Decimal point (numpad)
                                event.keyCode === 188 ||  // Comma
                                event.keyCode === 46 ) {  // Numpad dot
                        key = self.decimal_point;
                    } else if (event.keyCode >= 48 && event.keyCode <= 57) { // Numbers
                        key = '' + (event.keyCode - 48);
                    } else if (event.keyCode === 45) { // Minus
                        key = '-';
                    } else if (event.keyCode === 43) { // Plus
                        key = '+';
                    }else{
                    	self.pos.set_login_from(false);
                    }
                } else { // keyup/keydown
                    if (event.keyCode === 46) { // Delete
                        key = 'CLEAR';
                    } else if (event.keyCode === 8) { // Backspace
                        key = 'BACKSPACE';
                    }
                }

                self.payment_input(key);
                event.preventDefault();
            };
            this.use_wallet = function(event){
            	var order = self.pos.get_order(); 
            	if(order.getNetTotalTaxIncluded() <= 0){
    				return
    			}
    	    	order.set_use_wallet(!order.get_use_wallet());
                if (order.get_use_wallet()) {
                	if(order.get_client()){
                		if(self.pos.config.wallet_product.length > 0){
                			$('div.js_use_wallet').addClass('highlight');
                    		var product = self.pos.db.get_product_by_id(self.pos.config.wallet_product[0]);
                    		var params = {
                        		model: "res.partner",
                        		method: "search_read",
                        		domain: [['id', '=', order.get_client().id]],
                        		fields:['remaining_wallet_amount']
                        	}
                        	rpc.query(params, {async: false})
                    		.then(function(results){
                    			if(!product){
                    				return self.pos.db.notification('warning',"Wallet product is not loaded into pos, Please remove product cache from pos configuration and try again.");
                    			}
                    			_.each(results, function(result){
                    				var price = 0;
                    				var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                    				if(order.get_total_with_tax() <= result.remaining_wallet_amount){
                    					price = order.get_total_with_tax() * -1;
                    				}else if(order.get_total_with_tax() >= result.remaining_wallet_amount){
                    					price = result.remaining_wallet_amount * -1;
                    				}
                    				order.set_used_amount_from_wallet(Math.abs(price));
                    				order.set_type_for_wallet('change');
                    				line.set_quantity(1);
                    				line.set_unit_price(price);
                    				order.add_orderline(line);
                    				self.renderElement()
                    			});
                    		});
                		}
                	}else{
                		self.pos.db.notification('danger',"Please select customer!");
                	}
                } else{
                    $('.js_use_wallet').removeClass('highlight');
                    order.set_used_amount_from_wallet(false)
                    _.each(order.get_orderlines(), function(line){
                    	if(line && line.get_product().id === self.pos.config.wallet_product[0]){
                    		order.remove_orderline(line);
                    	} 
                    });
                    self.renderElement();
                }
    	    };
    	},
    	partial_payment: function() {
            var self = this;
            var currentOrder = this.pos.get_order();
            var client = currentOrder.get_client() || false;

            if(currentOrder.get_total_with_tax() > 0 && currentOrder.get_due() != 0){
				if(currentOrder.get_total_with_tax() > currentOrder.get_total_paid()
        			&& currentOrder.get_total_paid() != 0){
					var credit = currentOrder.get_total_with_tax() - currentOrder.get_total_paid();
					if (client && credit > client.remaining_credit_limit && !currentOrder.get_paying_due() && !currentOrder.get_cancel_order()){
						self.gui.show_popup('max_limit',{
							remaining_credit_limit: client.remaining_credit_limit,
							payment_obj: self,
						});
						return
					}
        	    }
            	if(currentOrder.get_reservation_mode() && !currentOrder.get_paying_due() && !currentOrder.get_cancel_order() && self.pos.config.enable_pos_welcome_mail){
            		currentOrder.set_fresh_order(true);
            	}
            	if(!currentOrder.get_reservation_mode()){
            	    currentOrder.set_partial_pay(true);
            	} else {
            	    currentOrder.set_draft_order(true);
            	}
				if(!currentOrder.get_delivery_date() && currentOrder.get_total_paid() > 0){
					self.gui.show_popup("delivery_date_popup", { 'payment_obj': self, 'new_date': true });
				} else {
					if(currentOrder.get_total_paid() != 0){
						this.finalize_validation();
					} else{
						var credit = currentOrder.get_total_with_tax() - currentOrder.get_total_paid();
						if(self.pos.config.allow_reservation_with_no_amount && self.pos.config.enable_order_reservation){
							if (client && credit > client.remaining_credit_limit && !currentOrder.get_paying_due() && !currentOrder.get_cancel_order()){
								self.gui.show_popup('max_limit',{
									remaining_credit_limit: client.remaining_credit_limit,
									payment_obj: self,
								});
								return
							}else{
								this.finalize_validation();
							}
						}
					}
//					$('.js_reservation_mode').removeClass('highlight');
				}
        	}
        },
    	renderElement: function(){
            this._super();
            var self =  this;
            var order = self.pos.get_order();
            self.pos.credit = false;
            $("#payment_total").html(self.format_currency(order.getNetTotalTaxIncluded()));
            if(self.pos.config.enable_wallet && self.pos.get_cashier().access_wallet){
          	    self.el.querySelector('.js_use_wallet').addEventListener('click', this.use_wallet);
            }
            this.$('.rounding').click(function(){
            	self.toggle_rounding_button();
            });
            this.$('#partial_pay').click(function(){
            	if(self.pos.get_order().get_client()){
                	self.partial_payment();
                } else {
                	self.gui.show_screen('clientlist');
                }
            });
            this.$('#is_serial').click(function(){
                var order = self.pos.get('selectedOrder');
                order.set_print_serial($('#is_serial').is(':checked'));
            });
            this.$('#is_ereciept').click(function(){
                var order = self.pos.get('selectedOrder');
                var customer_email = order.get_client() ? order.get_client().email : false;
                if($('#is_ereciept').is(':checked')) {
                    $('#email_id').fadeTo('fast', 1).css({ visibility: "visible" });
                    $('#email_id').focus();
                    if(order.get_client()){
                    	$('#update_email_tr').show();
                    }
                    if(customer_email){
                        $('#email_id').val(customer_email);
                    } else {$('#email_id').val('');}
                } else {
                    $('#email_id').fadeTo('fast', 0, function () {
                        $('#email_id').css({ visibility: "hidden" });
                    });
                    $('#update_email_tr').hide();
                }
            });
            this.$('div.1quickpay').click(function(){
    	    	var amt = $(this).attr('data') ? Number($(this).attr('data')) : false;
    	    	if(amt){
    	    		var cashregister = false;
    	    		for(var i in self.pos.cashregisters){
    	    			var reg = self.pos.cashregisters[i];
    	    			if(reg.journal_id[0] == self.pos.config.cash_method[0] ){
    	    				cashregister = reg;
    	    			}
    	    		}
    	    		if (cashregister){
    	    			var order = self.pos.get_order();
                        order.add_paymentline(cashregister);
                        order.selected_paymentline.set_amount( Math.max(amt),0 );
                        self.reset_input();
                        self.render_paymentlines();
                        self.order_changes();
                        if(self.pos.config.validate_on_click){
                        	self.validate_order();
                        }
                    } 
    	    	}
    	    });
            this.$('.emptybox_del_date').click(function(){
            	var order = self.pos.get_order();
            	$('#txt_del_date').val('');
            	order.set_delivery_date(false);
            });
            this.$('.emptybox_del_time').click(function(){
            	var order = self.pos.get_order();
            	$('#txt_del_time').val('');
            	order.set_delivery_time(false);
            });
            this.$('.js_redeem_loyalty').click(function(){
    			var order = self.pos.get_order();
    			if(order.getNetTotalTaxIncluded() <= 0){
    				return
    			}
    			if(order.get_client()){
    				if(self.pos.loyalty_config){
    					if(order.get_client().total_remaining_points > 0){
        					self.click_redeem_loyalty();
        				} else {
        					self.gui.show_popup('error',{
        						title: _t("Loyalty Points"),
        						body: _t(order.get_client().name + " have 0 points to redeem."),
        					})
        				}
    				}else{
    					self.pos.db.notification('danger',"Please configure loyalty configuration.");
    				}
    			}else{
    				self.pos.db.notification('danger',"Please select customer.");
    			}
            });
            this.$('.js_gift_card').click(function(){
            	var order = self.pos.get_order();
            	if(order.getNetTotalTaxIncluded() <= 0){
    				return
    			}
                var client = order.get_client();
                if(!order.get_giftcard().length > 0 && !order.get_recharge_giftcard().length > 0 ){
                    self.gui.show_popup('redeem_card_popup', {'payment_self': self});
                }
            });
        },
        click_redeem_loyalty: function(){
    		var order = this.pos.get_order();
    		if(order.get_client()){
    			this.gui.show_popup("redeem_loyalty_points", {payment_self: this});
    		}
    	},
    	payment_input: function(input) {
    		if(input){
    			var self = this;
        		var order = this.pos.get_order();
        		if(order.selected_paymentline && order.selected_paymentline.get_freeze_line()){
        			return
        		}
        		if(order.selected_paymentline && order.selected_paymentline.get_freeze()){
            		return
            	}
        		this._super(input);
    		}
    	},
        toggle_rounding_button: function(){
	    	var self = this;
	    	var order = this.pos.get_order();
	    	var $rounding_elem = $('#pos-rounding');
	    	if($rounding_elem.hasClass('fa-toggle-off')){
	    		$rounding_elem.removeClass('fa-toggle-off');
	    		$rounding_elem.addClass('fa-toggle-on');
	    		order.set_rounding_status(true);
	    	} else if($rounding_elem.hasClass('fa-toggle-on')){
	    		$rounding_elem.removeClass('fa-toggle-on');
	    		$rounding_elem.addClass('fa-toggle-off');
	    		order.set_rounding_status(false);
	    	}
	    	this.render_paymentlines();
	    },
        show: function() {
        	self = this;
            self._super();
            var order = self.pos.get_order();
            if(order.get_reservation_mode()){
//                self.$('#partial_pay').show();
                self.$('#partial_pay').text("Reserve");
            } else {
                self.$('#partial_pay').text("Partial Pay");
            }
            order.set_credit_mode(false)
            if(order && order.get_client()){
                $('.js_use_credit').show();
                this.remaining_balance = order.get_client().remaining_credit_amount;
                self.renderElement();
            }else{
                $('.js_use_credit').hide();
            }
            if(order.get_total_with_tax() > 0){
                if((order.get_paying_due() || order.get_cancel_order())){
                    self.$('#partial_pay, .next').show();
                }
            } else {
                self.$('#partial_pay').hide();
                self.$('.next').show();
            }
            if((order.get_paying_due() || order.get_cancel_order())){
                self.$('#partial_pay').text("Pay");
            }
            $("#payment_total").html(this.format_currency(order.getNetTotalTaxIncluded()));
            $("#email_id").focus(function() {
            	$('body').off('keypress', self.keyboard_handler);
            	$('body').off('keydown',self.keyboard_keydown_handler);
            	window.document.body.removeEventListener('keypress',self.keyboard_handler);
                window.document.body.removeEventListener('keydown',self.keyboard_keydown_handler);
            });
            $("#email_id").focusout(function() {
            	$('body').keypress(self.keyboard_handler);
		        $('body').keydown(self.keyboard_keydown_handler);
            	window.document.body.addEventListener('keypress',self.keyboard_handler);
                window.document.body.addEventListener('keydown',self.keyboard_keydown_handler);
            });
            $("textarea#order_note").focus(function() {
            	$('body').off('keypress', self.keyboard_handler);
            	$('body').off('keydown',self.keyboard_keydown_handler);
                window.document.body.removeEventListener('keypress',self.keyboard_handler);
                window.document.body.removeEventListener('keydown',self.keyboard_keydown_handler);
            });
            $("textarea#order_note").focusout(function() {
            	order.set_order_note($('#order_note').val());
            	$('body').keypress(self.keyboard_handler);
		        $('body').keydown(self.keyboard_keydown_handler);
                window.document.body.addEventListener('keypress',self.keyboard_handler);
                window.document.body.addEventListener('keydown',self.keyboard_keydown_handler);
            });
            $("textarea#txt_del_add").focus(function() {
            	$('body').off('keypress', self.keyboard_handler);
            	$('body').off('keydown',self.keyboard_keydown_handler);
                window.document.body.removeEventListener('keypress',self.keyboard_handler);
                window.document.body.removeEventListener('keydown',self.keyboard_keydown_handler);
            });
            $("textarea#txt_del_add").focusout(function() {
            	$('body').keypress(self.keyboard_handler);
		        $('body').keydown(self.keyboard_keydown_handler);
                window.document.body.addEventListener('keypress',self.keyboard_handler);
                window.document.body.addEventListener('keydown',self.keyboard_keydown_handler);
            });
            if(order.get_is_delivery()){
            	$('#delivery_details').show();
            	if(order.get_delivery_date()){
            		$('#txt_del_date').val(order.get_delivery_date());
            	}
            	if(order.get_delivery_time()){
            		$('#txt_del_time').val(order.get_delivery_time());
            	}
            	if(order.get_delivery_address()){
            		$('#txt_del_add').val(order.get_delivery_address());
            	} else if(order.get_client()){
            		$('#txt_del_add').val(order.get_client().address);
            	}
            	self.$("#txt_del_date").datepicker({
            		minDate: 0,
            		onSelect: function(dateText, inst) {
            			order.set_delivery_date(dateText);
            		},
            	});
    	        self.$("#txt_del_time").timepicker({
    	        	'timeFormat': 'h:i A',
    	        });
    	        self.$("#txt_del_time").change(function(){
    	        	var time = $("#txt_del_time").val();
    	        	order.get_delivery_time(time);
    	        })
    	        self.$('#txt_del_add').change(function(){
    	        	var address = $('#txt_del_add').val();
    	        	order.set_delivery_address(address);
    	        });
            }else{
            	$('#delivery_details').hide();
            }
        },
        validate_order: function(force_validation) {
            var self = this;
            var order = this.pos.get_order();
            if((this.pos.get_order().get_total_with_tax() < 0) && this.pos.get_order().get_paymentlines().length == 0){
                return alert(_t('Please select a journal.'));
            }
            if(self.pos.config.enable_card_charges && self.pos.get_cashier().access_card_charges){
                this.add_charge_product();
            }
			if(self.pos.pos_session.locked){
				self.pos.db.notification('danger',"This session has been blocked can't process order.");
				return
			}
            if (this.order_is_valid(force_validation)) {
            	//Bind notes for Order for store on database
            	if(this.pos.config.enable_order_note) {
                    order.set_order_note($('#order_note').val());
                }
            	// E-receipt setup
            	order.set_ereceipt_mail($('#email_id').val());
                if($('#is_ereciept').is(':checked')){
                    order.set_prefer_ereceipt(true);
                } else {
                    order.set_prefer_ereceipt(false);
                }
                if (order.get_client() && order.get_client().id && $('#update_email').is(':checked')) {
                	var params = {
                		model: "res.partner",
                		method: "write",
                		args: [order.get_client().id, {'email': order.get_ereceipt_mail()}]
                	}
                	rpc.query(params, {async: false}).fail(function(){
                    	self.pos.db.notification('danger',"Connection lost");
                    });
                }
                // delivery charges
                if(self.pos.config.enable_delivery_charges){
                	var time = order.get_delivery_time();
                    if(!time){
                    	time = $("#txt_del_time").val();
                    	if(time){
                    		order.set_delivery_time(time);
                    	}
                	}
                    var address = order.get_delivery_address();
                    if(!address){
                    	address = $('#txt_del_add').val();
                    	if(address){
                    		order.set_delivery_address(address);
                    	}
                    }
        			var date = order.get_delivery_date();
                	var is_deliver = order.get_is_delivery();

                	if(is_deliver && (!date || !time || !address)){
                		return self.pos.db.notification('danger',_t('Delivery information required to validate order!'));
                	}
                }
    	    	if(order.get_discount_product_id() && order.get_order_total_discount() > 0){
                	order.set_discount_price(order.get_order_total_discount());
                	var product = self.pos.db.get_product_by_id(order.get_discount_product_id());
    				var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
    				new_line.set_quantity(-1);
    				new_line.set_unit_price(order.get_order_total_discount());
                    order.add_orderline(new_line);
                }
            }
            this.pos.get_order().set_reservation_mode(false);
            if(order.get_change() && self.pos.config.enable_wallet && self.pos.get_cashier().access_wallet){
            	return self.gui.show_popup('AddToWalletPopup');
            }
           	this._super(force_validation);
        },
        add_charge_product: function(){
        	var self = this;
        	var selectedOrder = self.pos.get_order();
            var paylines = selectedOrder.get_paymentlines();
            var charge_exist = false;
            var total_charges = 0;
            if(paylines){
            	paylines.map(function(payline){
            		if(payline.cashregister.journal.apply_charges){
	            		var paycharge = Number(payline.get_payment_charge());
	            		total_charges += paycharge;
	            		payline.set_amount(payline.get_amount() + paycharge);
            		}
            	});
            	if(total_charges > 0){
	 				var product = self.pos.db.get_product_by_id(self.pos.config.payment_product_id[0]);
	 				if(product){
    					selectedOrder.add_product(product, {
    						quantity: 1,
    						price: Number(total_charges),
    					})
    				}
            	}
            }
        },
        click_delete_paymentline: function(cid){
        	var self = this;
            var lines = self.pos.get_order().get_paymentlines();
            var order = self.pos.get_order();
            var get_redeem = order.get_redeem_giftcard();
            var vouchers = order.get_voucher();
            for ( var i = 0; i < lines.length; i++ ) {
                if (lines[i].cid === cid) {
                    _.each(get_redeem, function(redeem){
                        if(lines[i].get_giftcard_line_code() == redeem.redeem_card ){
                            order.remove_card(lines[i].get_giftcard_line_code());
                        }
                    });
                    _.each(vouchers, function(j){
	            		if (lines[i].get_gift_voucher_line_code() == j.voucher_code && j.voucher_amount == lines[i].amount){
			            	order.remove_voucher(lines[i].get_gift_voucher_line_code(), lines[i].pid);
			            } 
	            	});
                    order.remove_paymentline(lines[i]);
                    self.reset_input();
                    self.render_paymentlines();
                    return
                }
            }
        	self.order_changes();
        	return;
        },
        order_is_valid: function(force_validation) {
	    	var self = this;

	    	var order = this.pos.get_order();
	    	if (order.get_voucher().length > 0 && !order.get_client()) {
				this.gui.show_popup('error',{
					'title': _t('Voucher Used'),
					'body':  _t('Customer is required for using Voucher.'),
				});
            	return false;
        	}
        	return this._super(force_validation);
	    },
        order_changes: function(){
        	this.render_paymentlines();
        	this._super();
        	var order = this.pos.get_order();
            var total = order ? order.get_total_with_tax() : 0;
            if(!order){
            	return
            } else if(order.get_due() == total || order.get_due() == 0){
            	this.$('#partial_pay').removeClass('highlight');
            } else {
            	this.$('#partial_pay').addClass('highlight');
            }
            if(this.pos.config.allow_reservation_with_no_amount){
            	if(order.get_due() != total || order.get_due() == 0){
            		$('#partial_pay').removeClass('highlight');
            	}else{
            		$('#partial_pay').addClass('highlight');
            	}
            }
        },
        click_gift_voucher: function(event){
        	var self = this;
        	if(self.pos.get_order().getNetTotalTaxIncluded() <= 0){
				return
			}
	    	if(self.pos.get_order().get_client()){
           		self.gui.show_popup('redeem_gift_voucher_popup', {'payment_self': self});
           	} else {
           		self.pos.db.notification('danger',_t("Customer is required"));
           	}
	    },
	    click_set_customer: function(){
	        var self = this;
	        var lines = self.pos.get_order().get_paymentlines();
	        var temp = _.find(lines, function(line){ return line.get_gift_voucher_line_code() })
	        if(temp){
	           return
	        }
	        this._super();
	    },
	    click_back_hold: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	if(order && order.get_giftcard() && order.get_giftcard()[0]){
	    		self.gui.show_popup('confirm',{
	                   title: _t('Discard Gift Card'),
	                   body:  _t('Do you want to discard the payment of gift card ?'),
	                   confirm: function() {
	                       order.finalize();
	                   },
	               });
	    	}else if(order.get_paying_due() || order.get_cancel_order()){
                this.gui.show_popup('confirm',{
                    title: _t('Discard Sale Order'),
                    body:  _t('Do you want to discard the payment of POS '+ order.get_pos_reference() +' ?'),
                    confirm: function() {
                        order.finalize();
                    },
                });
	        } else{
	    		self.gui.show_screen('products');
	    	}
	    },
	    click_invoice: function(){
	        var order = this.pos.get_order();
	        if(order.get_cancel_order() || order.get_paying_due()){
	            return
	        }
	        this._super();
	    },
	    click_set_customer: function(){
	        var order = this.pos.get_order();
	        if(order.get_cancel_order() || order.get_paying_due()){
	            return
	        }
	        this._super();
	    },
	    render_paymentlines: function() {
            var self  = this;
            var order = this.pos.get_order();
            if (!order) {
                return;
            }

            var lines = order.get_paymentlines();
            var due   = order.get_due();
            var extradue = 0;
            var charge = 0;
            if (due && lines.length  && due !== order.get_due(lines[lines.length-1])) {
                extradue = due;
            }

            if(self.pos.config.enable_card_charges && self.pos.get_cashier().access_card_charges){
		        if (order.selected_paymentline && order.selected_paymentline.cashregister.journal.apply_charges) {
		        	if(order.selected_paymentline.cashregister.journal.optional){
		        	}else{
			        	if(order.selected_paymentline.cashregister.journal.fees_type === _t('percentage')){
			        		charge = (order.selected_paymentline.get_amount() * order.selected_paymentline.cashregister.journal.fees_amount) / 100;
			        	} else if(order.selected_paymentline.cashregister.journal.fees_type === _t('fixed')){
			        		charge = order.selected_paymentline.cashregister.journal.fees_amount;
			        	}
		        	}
		        	order.selected_paymentline.set_payment_charge(charge.toFixed(2));
		        }
	        }

            this.$('.paymentlines-container').empty();
            var lines = $(QWeb.render('PaymentScreen-Paymentlines', {
                widget: this,
                order: order,
                paymentlines: lines,
                extradue: extradue,
            }));

            lines.on('click','.delete-button',function(){
                self.click_delete_paymentline($(this).data('cid'));
            });

            lines.on('click','.paymentline',function(){
                self.click_paymentline($(this).data('cid'));
            });

            lines.on('input','.payment_charge_input',function(){
	        	order.selected_paymentline.set_payment_charge($(this).val());
	        });

            if(self.pos.config.enable_card_charges && self.pos.get_cashier().access_card_charges) {
		        lines.on('focus','.payment_charge_input',function(){
		        	window.document.body.removeEventListener('keypress',self.keyboard_handler);
	                window.document.body.removeEventListener('keydown',self.keyboard_keydown_handler);
		        });
		        lines.on('focusout','.payment_charge_input',function(){
		        	window.document.body.addEventListener('keypress',self.keyboard_handler);
	                window.document.body.addEventListener('keydown',self.keyboard_keydown_handler);
		        });
	        }

            lines.appendTo(this.$('.paymentlines-container'));
            var customer_display = this.pos.config.customer_display;
    		if(customer_display){
    			this.pos.get_order().mirror_image_data();
    		}
        },
    });
    
    var OrderDetailScreenWidget = screens.ScreenWidget.extend({
	    template: 'OrderDetailScreenWidget',
	     init: function(parent, options){
	        var self = this;
	        self._super(parent, options);
	    },
        show: function(){
            var self = this;
            self._super();

            var order = self.pos.get_order();
            var params = order.get_screen_data('params');
            var order_id = false;
            if(params){
                order_id = params.order_id;
            }
            if(order_id){
                self.clicked_order = self.pos.db.get_order_by_id(order_id)
            }
            this.renderElement();
            this.$('.back').click(function(){
                self.gui.back();
                if(params.previous){
                    self.pos.get_order().set_screen_data('previous-screen', params.previous);
                    if(params.partner_id){
                        $('.client-list-contents').find('.client-line[data-id="'+ params.partner_id +'"]').click();
                        $('#show_client_history').click();
                    }
                }

            });
            if(self.clicked_order){
				this.$('.pay').click(function(){
                    self.pos.gui.screen_instances.orderlist.pay_order_due(false, order_id)
                });
				var contents = this.$('.order-details-contents');
				contents.append($(QWeb.render('OrderDetails',{widget:this, order:self.clicked_order})));
				var params = {
					model: 'account.bank.statement.line',
					method: 'search_read',
					domain: [['pos_statement_id', '=', order_id]],
				}
				rpc.query(params, {async: false})
//				new Model('account.bank.statement.line').call('search_read',
//				[[['pos_statement_id', '=', order_id]]], {}, {'async': true})
				.then(function(statements){
					if(statements){
						self.render_list(statements);
					}
				});
            }

        },
        render_list: function(statements){
            var contents = $('.paymentline-list-contents');
            contents.html('');
            for(var i = 0, len = Math.min(statements.length,1000); i < len; i++){
                var statement = statements[i];
                var paymentline_html = QWeb.render('PaymentLines',{widget: this, statement:statement});
                var paymentline = document.createElement('tbody');
                paymentline.innerHTML = paymentline_html;
                paymentline = paymentline.childNodes[1];
                contents.append(paymentline);
            }
        },
	});
	gui.define_screen({name:'orderdetail', widget: OrderDetailScreenWidget});

    screens.OrderWidget.include({
    	init: function(parent, options) {
            var self = this;
            this._super(parent,options);
            this.line_dblclick_handler = function(event){
            	var order = self.pos.get_order();
                var selected_line = order.get_selected_orderline();
                if(selected_line && selected_line.is_bag){
                	return;
                }
            	self.gui.show_popup('add_note_popup');
            };
        },
    	update_summary: function(){
    		var self = this;
    		var order = self.pos.get_order();
    		var total = order ? order.get_total_with_tax() : 0;
    		var discount = 0;
    		if(self.pos.config.pos_promotion && self.pos.get_cashier().access_pos_promotion){
    			discount = order ? order.calculate_discount_amt() : 0;
    		}
    		order.set_order_total_discount(Number(discount));
    		if(this.el.querySelector('.discount .value')){
    			this.el.querySelector('.discount .value').textContent = this.format_currency(discount);
    		}
    		self._super();
    		if (!order.get_orderlines().length) {
    			$('.cart-num').text(0);
    			return
    		}else{
    			var qty = 0;
    			order.get_orderlines().map(function(line){
                    // get_dummy_product_ids
                    if(($.inArray(line.product.id, order.get_dummy_product_ids()) == -1)){
                        qty += line.get_quantity();
                    }
    			});
    			$('.cart-num').text(qty);
    		}
    		if(order.get_client()){
		        if(this.pos.loyalty_config && this.pos.loyalty_config.points_based_on == 'product'){
		        	var total_points = this.get_points_from_product();
		        	if(this.el.querySelector('.loyalty_info_cart .value')){
		        		this.el.querySelector('.loyalty_info_cart .value').textContent = total_points;
		        	}
		        	order.set_loyalty_earned_point(total_points);
		        	order.set_loyalty_earned_amount(order.get_loyalty_amount_by_point(total_points));
		        } else if(this.pos.loyalty_config && this.pos.loyalty_config.points_based_on == 'order') {
		        	if(order.get_total_with_tax() >=  this.pos.loyalty_config.minimum_purchase 
		        			&& this.pos.loyalty_config.point_calculation > 0){
		        		var total_points = this._calculate_loyalty_by_order();
		        		if(total_points > 0){
		        			if(this.el.querySelector('.loyalty_info_cart .value')){
				        		this.el.querySelector('.loyalty_info_cart .value').textContent = total_points.toFixed(2);
				        	}
		        			order.set_loyalty_earned_point(total_points.toFixed(2));
		        			order.set_loyalty_earned_amount(order.get_loyalty_amount_by_point(total_points));
		        		}
		        	} else if(order.get_total_with_tax() <  this.pos.loyalty_config.minimum_purchase){
		        		order.set_loyalty_earned_point(0.00);
		        	}
		        }
	        }
    	},
    	_calculate_loyalty_by_order: function(){
			var order = this.pos.get_order();
			return (order.get_total_with_tax() * this.pos.loyalty_config.point_calculation) / 100
		},
		get_points_from_product: function(){
			var self = this;
			var order = this.pos.get_order();
			var currentOrderline = order.get_orderlines()
			var total_points = 0.00
			_.each(currentOrderline, function(line){
				var line_points = 0.00;
				if(line.get_product().loyalty_point){
					line_points = line.get_product().loyalty_point * line.get_quantity();;
					total_points += line_points;
				} else if(line.get_product().pos_categ_id){
					var cat_point = self._get_points_from_categ(line.get_product().pos_categ_id[0]);
					if (cat_point){
						line_points = cat_point * line.get_quantity();
						total_points += line_points;
					}
				}
//				line.set_line_loyalty_point(line_points);
//				line.set_line_loyalty_amount(self.get_loyalty_amount_by_point(line_points));
			});
			return total_points;
		},
		_get_points_from_categ: function(categ_id){
			var category = this.pos.db.get_category_by_id(categ_id);
			if(category && category.loyalty_point){
				return category.loyalty_point;
			} else if(category.parent_id){
				this._get_points_from_categ(category.parent_id[0]);
			}
			return false;
		},
    	render_orderline: function(orderline){
    		var el_node = this._super(orderline);
    		var self = this;
    		if (this.pos.config.enable_product_note && this.pos.get_cashier().access_product_note) {
    			el_node.addEventListener('dblclick',this.line_dblclick_handler);
            }
			var el_remove_icon = el_node.querySelector('.remove_line');
	        if(el_remove_icon){
	        	el_remove_icon.addEventListener('click', (function() {
	        		var order = self.pos.get_order();
	        		var lines = order.get_orderlines();
	        		if(orderline && orderline.get_delivery_charges_flag()){
	        			lines.map(function(line){
	        				line.set_deliver_info(false);
	        			});
	        			order.set_is_delivery(false);
	        		}
	        		order.remove_orderline(orderline);
	        		order.remove_promotion();
	            }.bind(this)));
	        }
	        var oe_del = el_node.querySelector('.oe_del');
            if(oe_del){
            	oe_del.addEventListener('click', (function() {
            		if(!confirm(_t("Are you sure you want to unassign lot/serial number(s) ?"))){
        	    		return;
        	    	}
            		var pack_lot_lines = orderline.pack_lot_lines;
            		var len = pack_lot_lines.length;
            		var cids = [];
            		for(var i=0; i<len; i++){
            			var lot_line = pack_lot_lines.models[i];
            			cids.push(lot_line.cid);
            		}
            		for(var j in cids){
            			var lot_model = pack_lot_lines.get({cid: cids[j]});
            			lot_model.remove();
            		}
            		self.renderElement();
            	}.bind(this)));
            }
	        $(".order-scroller").scrollTop($('.order-scroller .order').height());
    		return el_node
    	},
    	set_value: function(val) {
    		var self = this;
    		var order = this.pos.get_order();
    		var lines = order.get_orderlines();
            this.numpad_state = this.numpad_state;
            var mode = this.numpad_state.get('mode');
            var selected_line = order.get_selected_orderline();
            if (selected_line && selected_line.get_quantity() < 0 && selected_line.attributes.backorder
            		&& (val != '' || val != 'remove')) {
            	return //Disable numpad for return items except remove
            }
            if(selected_line && mode != "quantity" && selected_line.is_bag){
            	return //Disable price and discount for bag product
            }
            if(selected_line && (mode == "quantity" || mode == "discount") && selected_line.get_delivery_charges_flag()){
            	return
            }
            if(selected_line){
				if(selected_line.get_child_line_id()){
					var child_line = order.get_orderline(selected_line.get_child_line_id());
					lines.map(function(line){
						if(line.get_child_line_id() == selected_line.get_child_line_id()){
							line.set_child_line_id(false);
							line.set_is_rule_applied(false);
						}
					});
					if(child_line){
						selected_line.set_child_line_id(false);
						selected_line.set_is_rule_applied(false);
						order.remove_orderline(child_line);
					}
					self._super(val);
				}else if(selected_line.get_buy_x_get_dis_y()){
					self._super(val);
					if(selected_line.get_quantity() < 1){
						_.each(lines, function(line){
							if(line && line.get_buy_x_get_y_child_item()){
//								order.remove_orderline(line);
								line.set_discount(0);
								line.set_buy_x_get_y_child_item({});
								line.set_is_rule_applied(false);
								line.set_promotion_data(false);
								self.pos.chrome.screens.products.order_widget.rerender_orderline(line);
							}
						});
					}
				}else if(selected_line.get_quantity_discount()){
					selected_line.set_quantity_discount({});
					selected_line.set_discount(0);
					selected_line.set_promotion_data(false);
					selected_line.set_is_rule_applied(false);
					self._super(val);
				}else if(selected_line.get_discount_amt()){
					selected_line.set_discount_amt_rule(false);
					selected_line.set_discount_amt(0);
					selected_line.set_promotion_data(false);
					selected_line.set_unit_price(selected_line.product.price);
					selected_line.set_is_rule_applied(false);
					self._super(val);
				}
				else if(selected_line.get_multi_prods_line_id()){
					var multi_prod_id = selected_line.get_multi_prods_line_id() || false;
					if(multi_prod_id){
						_.each(lines, function(_line){
							if(_line && _line.get_multi_prods_line_id() == multi_prod_id){
								_line.set_discount(0);
								_line.set_is_rule_applied(false);
								_line.set_promotion_data(false);
								_line.set_combinational_product_rule(false);
								self.pos.chrome.screens.products.order_widget.rerender_orderline(_line);
							}
						});
					}
					self._super(val);
				}else if(selected_line.get_multi_prod_categ_rule()){
					selected_line.set_discount(0);
					selected_line.set_is_rule_applied(false);
					selected_line.set_multi_prod_categ_rule(false);
					self._super(val);
				}
				else{
					if(!selected_line.get_promotion()){
			            if(this.pos.config.enable_operation_restrict){
					    	if (order.get_selected_orderline()) {
					            var mode = this.numpad_state.get('mode');
					            var cashier = this.pos.get_cashier() || false;
					            if( mode === 'quantity'){
					                order.get_selected_orderline().set_quantity(val);
					            }else if( mode === 'discount'){
					            	if(cashier && cashier.can_give_discount){
					            		if(val <= cashier.discount_limit || cashier.discount_limit < 1){
					            			order.get_selected_orderline().set_discount(val);
					            			if(val == ''){
					            				this.numpad_state.change_mode = true
					            			}
					            		} else {
					            		    if(cashier.based_on == 'barcode'){
					            			    this.gui.show_popup('ManagerAuthenticationPopup', { val: val });
					            			}
					            			else{
					            			    var user_detail = {} ,password = [];
			                                     _.each(self.pos.users, function(value) {
			                                        user_detail[value.id] = value;
			                                        password.push(value.pos_security_pin)
			                                    });

					            			    var res = self.gui.authentication_pin(password).then(function(){
			                                        self.pos.get_order().get_selected_orderline().set_discount(val);
							    				    self.gui.close_popup();
			                                    });
					            			}
					            		}
					            	} else {
//					            		alert(_t('You don\'t have access to give discount.'));
					            		self.pos.db.notification('danger',_t('You don\'t have access to give discount.'));
					            	}
					            } else if( mode === 'price'){
//					            	if(cashier && cashier.can_change_price){
					            		order.get_selected_orderline().set_unit_price(val);
//					            	} else {
//					            		alert(_t('You don\'t have access to change Price.'));
//					            		self.pos.db.notification('danger',_t('You don\'t have access to change Price.'));
//					            	}
					            }
					    	}
				    	} else {
				    		this._super(val)
				    	}
					}
				}
			}
    		order.apply_promotion();
    	},
    	renderElement: function() {
    		this._super();
    		var self = this;
    		/*$('#total_pay').click(function(){
    			var order = self.pos.get_order();
                var has_valid_product_lot = _.every(order.orderlines.models, function(line){
                    return line.has_valid_product_lot();
                });
                if(!has_valid_product_lot){
                    self.gui.show_popup('confirm',{
                        'title': _t('Empty Serial/Lot Number'),
                        'body':  _t('One or more product(s) required serial/lot number. Please Enter Serial/Lot Number'),
                        'hide_confirm': false,
                        confirm: function(){
                            self.gui.show_screen('payment');
                        },
                    });
                }else{
                    self.gui.show_screen('payment');
                }
    		});*/
    	},
    	click_line: function(orderline, event) {
            this._super(orderline, event);
            if(orderline.get_deliver_info()){
            	$('#delivery_mode').addClass('deliver_on')
            } else {
            	$('#delivery_mode').removeClass('deliver_on')
            }
        },
    });

    screens.ProductScreenWidget.include({
        set_back_to_parent_categ: function(id){
            var self = this;
            var products = self.pos.chrome.screens.products;
            if(id){
                var parent_categ = self.pos.db.get_category_by_id(id);
                var parent_categ_id = false;
                if(parent_categ && parent_categ.parent_id[0]){
                    parent_categ_id = parent_categ.parent_id[0];
                }else{
                    if(self.old_categ_id == id){
                        self.parent_categ_id = self.pos.db.root_category_id;
                        id = self.pos.db.root_category_id;
                        products.product_categories_widget.set_category(self.pos.db.get_category_by_id(id));
                        products.product_categories_widget.renderElement();
                    }else{
                        self.parent_categ_id = id;
                        products.product_categories_widget.set_category(self.pos.db.get_category_by_id(id));
                    }
                }
                self.old_categ_id = id;
                var sub_categories = products.product_categories_widget.subcategories;
                self.render_product_category(sub_categories);
            }
        },
    	start: function(){
	    	var self = this;
			self._super();
			self.namelist = [];
    		_.each(self.pos.db.get_product_namelist(),function(list){
    			if(list[0] !== self.pos.config.delivery_product_id[0]){
    				self.namelist.push(list[1]);
    			}
    		});
    		self.parent_categ_id = false;
			self.old_categ_id = 0;
			self.custom_switch_category_handler = function(event){
			    var id = $(event.target).attr('data-category-id') || 0;
			    var root_categ_id = self.pos.db.get_category_by_id(self.pos.db.root_category_id);
			    self.pos.chrome.screens.products.product_categories_widget.set_category(self.pos.db.get_category_by_id(id));
			    self.pos.chrome.screens.products.product_categories_widget.renderElement();
			    var products = self.pos.chrome.screens.products;
			    var sub_categories = products.product_categories_widget.subcategories;
			    if(id == 0){
			        self.parent_categ_id = false;
			        self.pos.chrome.screens.products.product_categories_widget.renderElement();
			        self.render_product_category(sub_categories)
			    }else{
			    	$('.category-simple-button').removeClass('menu-selected');
			    	$(event.target).addClass('menu-selected');
			    }
			    self.categ_id = self.pos.db.get_category_by_id(id);
			    if(self.categ_id.child_id && self.categ_id.child_id.length > 0){
			        self.render_product_category(sub_categories)
			    }
			    self.set_back_to_parent_categ(id);
            };
			$('.searchbox input').autocomplete({
                source:self.namelist,
        	});
			/*$('#total_pay').click(function(){
	        	self.gui.show_screen('payment');
    		});*/
			$('span.set_customer').click(function(){
				self.gui.show_screen('clientlist');
    		});
	        $('div#sale_mode').click(function(){
	        	var order = self.pos.get_order();
	        	order.change_mode("sale",this);
	        });
	        $('div#reservation_mode').click(function(){
	        	var order = self.pos.get_order();
	        	order.change_mode("reservation_mode",this);
	        });
	        $('div#order_return').click(function(){
	        	self.gui.show_popup('PosReturnOrderOption');
	        });
	        $('div#order_screen').click(function(){
	        	self.gui.show_screen('orderlist');
	        });
	        $('div#bag_charges').click(function(){
	        	var order = self.pos.get_order();
	        	if(order.is_empty()){
	        		$('div.order-empty').animate({
	            	    color: '#FFCCCC',
	            	}, 1000, 'linear', function() {
	            	      $(this).css('color','#DDD');
	            	});
	        		return
	        	}
	        	if(order.get_ret_o_id()){
	        		self.pos.db.notification('danger',_t('Sorry, This operation not allow to add bag!'));
	        		return
	        	}
	        	self.gui.show_popup('bags_popup');
	        });
	        $('div#draft_order').click(function(){
	        	var order = self.pos.get_order();
	        	if(order.is_empty()){
	        		$('div.order-empty').animate({
	            	    color: '#FFCCCC',
	            	}, 1000, 'linear', function() {
	            	      $(this).css('color','#DDD');
	            	});
	        		return
	        	}
	        	if(order.get_ret_o_id()){
	        		self.pos.db.notification('danger',_t('Sorry, This operation not allow to create draft order!'));
	        		return
	        	}
	        	var credit = order.get_total_with_tax() - order.get_total_paid();
         		var client = order.get_client();
            	if (client && credit > client.remaining_credit_limit){
            		return self.gui.show_popup('max_limit',{
         				remaining_credit_limit: client.remaining_credit_limit,
                        draft_order: true,
                    });
         	    }
	        	order.initialize_validation_date();
	            var currentOrderLines = order.get_orderlines();
	            var orderLines = [];
	            _.each(currentOrderLines,function(item) {
	                return orderLines.push(item.export_as_JSON());
	            });
//	            if(self.pos.config.enable_order_reservation && self.pos.config.allow_reservation_with_no_amount){
	            if(self.pos.config.enable_order_reservation){
	            	var credit = order.get_total_with_tax() - order.get_total_paid();
	         		var client = order.get_client();
	            	if (client && credit > client.remaining_credit_limit){
	         			self.gui.show_popup('max_limit',{
	         				remaining_credit_limit: client.remaining_credit_limit,
	                        draft_order: true,
	                    });
	                    return
	         	    } else {
	         	    	self.pos.push_order(order);
	                    self.gui.show_screen('receipt');
	                }
	            } else {
	            	self.gui.show_popup('confirm',{
		                'title': _t('Order Quotation'),
		                'body': _t('Do you want to create order as quotation?'),
		                confirm: function(){
		                	self.pos.push_order(order);
		                	self.gui.show_screen('receipt');
		                },
		            });
	            }
	        });
	    	$('div#product_qty').click(function(){
	    		var order = self.pos.get_order();
		        var lines = order.get_orderlines();
		        var orderLines = [];
		        var length = order.orderlines.length;
		        if(lines.length <= 0){
		        	$('div.order-empty').animate({
	            	    color: '#FFCCCC',
	            	}, 1000, 'linear', function() {
	            	      $(this).css('color','#DDD');
	            	});
		        }
		        if(order.get_selected_orderline()){
		        	var prod = order.get_selected_orderline().get_product();
		        	var prod_info = [];
	                var total_qty = 0;
	                var params = {
						model: 'stock.warehouse',
						method: 'disp_prod_stock',
						args: [prod.id,self.pos.shop.id],
					}
					rpc.query(params, {async: false}).then(function(result){
		                if(result){
		                	prod_info = result[0];
		                    total_qty = result[1];
		                    var prod_info_data = "";
		                    _.each(prod_info, function (i) {
		                    	prod_info_data += "<tr>"+
		                        "	<td style='color:gray;font-weight: initial !important;padding:5px;text-align: left;padding-left: 15px;'>"+i[0]+"</td>"+
		                        "	<td style='color:gray;font-weight: initial !important;padding:5px;text-align: right;padding-right: 15px;'>"+i[1]+"</td>"+
		                        "</tr>"
		                    });
		                    self.gui.show_popup('product_qty_popup',{prod_info_data:prod_info_data,total_qty: total_qty});
		                }
			    	}).fail(function(){
	                	self.pos.db.notification('danger',"Connection lost");
	                });
		        }
	    	});
	    	$('.empty-cart').click(function(){
	    		var order = self.pos.get_order();
		        var lines = order.get_orderlines();
		        if(lines.length > 0){
		        	self.gui.show_popup('confirm',{
		                'title': _t('Empty Cart ?'),
		                'body': _t('You will lose all items associated with the current order'),
		                confirm: function(){
		                	order.empty_cart();
		                },
		            });
		        } else {
		        	$('div.order-empty').animate({
	            	    color: '#FFCCCC',
	            	}, 1000, 'linear', function() {
	            	      $(this).css('color','#DDD');
	            	});
		        }
	        });
	        $('#multi-shop').click(function(){
	            var user_stores = self.pos.get_cashier().shop_ids;
	            var store_list = [];
	            _.each(user_stores, function(id){
	                var store = self.pos.shop_by_id[id]
	                if(store){store_list.push(store);}
	            });
	            if(store_list.length != 0) {
	                self.gui.show_popup('multi_store_popup',{'cashier_store':store_list});
	            } else{
	            	self.pos.db.notification('danger',_t('You have no access rights for select store!'));
	            }
	    	});
	    	$('#customer_display').click(function(){
	    		window.open(self.pos.attributes.origin+'/web/customer_display' , '_blank');
	    	});
	    	$('#delivery_mode').click(function(){
		    	var order = self.pos.get_order();
		    	var lines = order.get_orderlines();
		    	var line = order.get_selected_orderline();
		    	var selected_orderline = (line && line.get_quantity() > 0 && order.is_sale_product(line.product)) ? line : false;

		    	if(order.get_ret_o_id()){
		    		self.pos.db.notification('danger',_t('Sorry, This operation not allow to use delivery operation!'));
	        		return
	        	}
		    	if(selected_orderline && lines.length > 0){
			    	if(selected_orderline && !$('#delivery_mode').hasClass('deliver_on')){
			    		if(!selected_orderline.get_delivery_charges_flag()){
			    			selected_orderline.set_deliver_info(true);
			    		}else{
			    			$('#delivery_mode').removeClass('deliver_on');
			    		}
			    		var deliver_product_id = self.pos.config.delivery_product_id[0];
			    		var deliver_amt = self.pos.config.delivery_amount;
			    		var product = self.pos.db.get_product_by_id(deliver_product_id);
			    		if(!order.get_is_delivery()){
			    			if(product){
			    				var line_deliver_charges = new models.Orderline({}, {pos: self.pos, order:order, product: product});
				        		line_deliver_charges.set_quantity(1);
				        		line_deliver_charges.set_unit_price(deliver_amt || 0);
				        		line_deliver_charges.set_delivery_charges_color(true);
				        		line_deliver_charges.set_delivery_charges_flag(true);
				                order.add_orderline(line_deliver_charges);
				                order.set_is_delivery(true);
			    			}
			    		}
		                order.set_delivery(true);
		                $('#delivery_mode').addClass('deliver_on');
			    	}else if(selected_orderline && selected_orderline.get_deliver_info()){
			    		selected_orderline.set_deliver_info(false);
			    		order.count_to_be_deliver();
			    		$('#delivery_mode').removeClass('deliver_on');
			    	}else if(selected_orderline && !selected_orderline.get_deliver_info()){
			    		if(!selected_orderline.get_delivery_charges_flag()){
			    			selected_orderline.set_deliver_info(true);
			    		}else{
			    			$('#delivery_mode').removeClass('deliver_on');
			    		}
			    	}else{
			    		$('#delivery_mode').removeClass('deliver_on');
			    		selected_orderline.set_deliver_info(false);
			    		order.count_to_be_deliver();
			    	}
		    	}else if(order.get_is_delivery()){
		    		order.count_to_be_deliver();
		    	}else{
		    		//enable mode
		    		$('#delivery_mode').addClass('deliver_on');
		    		var deliver_product_id = self.pos.config.delivery_product_id[0];
		    		var deliver_amt = self.pos.config.delivery_amount;
		    		var product = self.pos.db.get_product_by_id(deliver_product_id);
		    		if(!order.get_is_delivery()){
		    			if(product){
		    				var line_deliver_charges = new models.Orderline({}, {pos: self.pos, order:order, product: product});
			        		line_deliver_charges.set_quantity(1);
			        		line_deliver_charges.set_unit_price(deliver_amt || 0);
			        		line_deliver_charges.set_delivery_charges_color(true);
			        		line_deliver_charges.set_delivery_charges_flag(true);
			                order.add_orderline(line_deliver_charges);
			                order.set_is_delivery(true);
		    			}
		    		}
	                order.set_delivery(true);
		    	}
			});
	    	$('#money_in').click(function(){
	    		if(self.pos.config.cash_control){
	    			var is_cashdrawer = false;
	    			self.gui.show_popup('cash_operation_popup', {
	    		    	button: this,
	    		    	title: "Put Money In",
	    		    	msg: 'Fill in this form if you put money in the cash register: ',
	    		    	operation: "put_money",
	    		    });
	    		}else{
	    			self.pos.db.notification('danger',_t('Please enable cash control from pos configuration.'));
	    		}
	    	});
	    	$('#money_out').click(function(){
	    		if(self.pos.config.cash_control){
	    			self.gui.show_popup('cash_operation_popup', {
	    		    	button: this,
	    		    	title: "Take Money Out",
	    		    	msg: 'Describe why you take money from the cash register: ',
	    		    	operation: "take_money",
	    		    });
	    		}else{
	    			self.pos.db.notification('danger',_t('Please enable cash control from pos configuration.'));
	    		}
	    	});
	    	$('#cash_in_out_stmt').click(function(){
	    		self.gui.show_popup('cash_inout_statement_popup');
	    	});
	    	$('#add_credit').click(function(){
	    		var customer = self.pos.get_order().get_client()
	            if(customer){
	                self.gui.show_popup('AddMoneyToCreditPopup', {new_client: customer});
	            }else{
	                self.gui.show_screen('clientlist');
	            }
	    	});
	    	$('#pay_debit').click(function(){
	    		var customer = self.pos.get_order().get_client()
	            if(customer){
	                self.gui.show_popup('pay_debit_popup');
	            }else{
	                self.gui.show_screen('clientlist');
	            }
	    	});
	    	$('#discard_product').click(function(){
		        var selectedOrder = self.pos.get_order();
		        var currentOrderLines = selectedOrder.get_orderlines();
		        var moveLines = [];
		        if(currentOrderLines.length <= 0){
	                self.pos.db.notification('warning',_t("Please select product."));
	                return
	            }
	            _.each(currentOrderLines,function(item) {
	                if(item.product.type != 'service'){
	                    var data = {}
	                    var nm = item.product.default_code ? "["+ item.product.default_code +"]"+ item.product.display_name  : "";
	                    data['product_id'] = item.product.id;
	                    data['name'] = nm || item.product.display_name;
	                    data['product_uom_qty'] = item.get_quantity();
	                    data['location_id'] = self.pos.config.stock_location_id[0] ;
	                    data['location_dest_id'] = self.pos.config.discard_location[0];
	                    data['product_uom'] = item.product.uom_id[0];
	                    moveLines.push(data);
	                }
	            });
	            var data = {}
	            data['moveLines'] = moveLines;
	            data['picking_type_id'] = self.pos.config.picking_type[0];
	            data['location_src_id'] =  self.pos.config.stock_location_id[0];
	            data['location_dest_id'] = self.pos.config.discard_location[0];
	            data['state'] = 'done';
	            var params = {
	                model: 'stock.picking',
	                method: 'do_detailed_discard_product',
	                args: [{ data:data }],
	            }
		        if(self.pos.get_cashier().discard_product){
	                if(self.pos.get_cashier().pos_security_pin){
	                    var pass = self.pos.get_cashier().pos_security_pin;
	                    self.pos.gui.ask_password(pass).then(function(){
	                        rpc.query(params, {async: false})
	                        .then(function(result){
	                            if(result && result[0] && result[0]){
	                                var url = window.location.origin + '#id=' + result[0] + '&view_type=form&model=stock.picking';
	                                self.pos.gui.show_popup('stock_pick', {'url':url, 'name':result[1]});
	                            }
	                        });
	                    });
	                }else{
	                    rpc.query(params, {async: false}).then(function(result){
	                        if(result && result[0] && result[0]){
	                              var url = window.location.origin + '#id=' + result[0] + '&view_type=form&model=stock.picking';
	                            self.pos.gui.show_popup('stock_pick', {'url':url, 'name':result[1]});
	                        }
	                    });
	                }
	            }else{
	                self.pos.db.notification('warning',_t("You don't have access rights for discard the product!"));
	                return
	            }
	    	})
    	},
    	show: function(){
    		this._super();
    		var self = this;
    		var order = this.pos.get_order();
    		var img_src = "<i style='font-size: 50px;' class='fa fa-user' aria-hidden='true'></i>"
    		var user_nm = "Guest Customer";
    		if(order.get_client()){
    			img_src = "<img style='height:50px;width:50px' src='"+this.partner_icon_url(order.get_client().id)+"'/>";
    			user_nm = order.get_client().name;
    		}
    		$('span.avatar-img').html(img_src);
    		$('span.c-user').html(user_nm);
    		$('.show-left-cart').hide();
    		$('.searchbox input').val('');
    		$('.category_searchbox input').val('');
    		$('.brand_searchbox input').val('');
    		var products = self.pos.chrome.screens.products;
            var sub_categories = products.product_categories_widget.subcategories;
//            if(self.pos.config.vertical_categories) {
                self.render_product_category(sub_categories);
                $('.searchbox input').keypress(function(event){
                    var search_value = $('.search').val();
                    var search_timeout = null;
                    if(event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8){
                        clearTimeout(search_timeout);
                        var categ = self.pos.chrome.screens.products.product_categories_widget.category;
                        var searchbox = this;
                        search_timeout = setTimeout(function(){
                            self.pos.chrome.screens.products.product_categories_widget.perform_search(categ, searchbox.value, event.which === 13);
                        },0);
                    }
                    self.pos.chrome.screens.products.product_categories_widget.renderElement();
                });
                $('.search-clear').click(function(){
                    self.pos.chrome.screens.products.product_categories_widget.clear_search();
                    $('.searchbox input').val('');
                    $('.searchbox input').focus();
                });
//            }
    	},
    	render_product_category: function(categ){
            var self = this;
            if(categ && categ[0]){
                var sub_categories_html = QWeb.render('CategoriesView',{
                    sub_categories: categ,
                    parent_categ_id:self.parent_categ_id,
                });
                $('.CustomCategories').html('');
                $('.CustomCategories').html(sub_categories_html);
                var $buttons = $('.js-category-switch');
                for(var i = 0; i < $buttons.length; i++){
                    $buttons[i].addEventListener('click',self.custom_switch_category_handler);
                }
            }
        },
    	partner_icon_url: function(id){
            return '/web/image?model=res.partner&id='+id+'&field=image_small';
        },
    });

    screens.ReceiptScreenWidget.include({
    	show: function(){
            var self = this;
            var order = this.pos.get_order();
            var barcode_val = order.get_giftcard();
            var vouchers = order.get_voucher();
            var counter = [];
            if(self.pos.config.enable_print_valid_days && self.pos.get_cashier().access_print_valid_days){
                var order_category_list = [];
                var orderlines = order.get_orderlines();
                _.each(orderlines, function(orderline){
                    if(orderline.get_product().pos_categ_id){
                        var category = self.pos.db.get_category_by_id(orderline.get_product().pos_categ_id[0]);
                        if (category && category.return_valid_days > 0){
                            order_category_list.push({
                                "id": category.id,
                                "name": category.name,
                                "return_valid_days": category.return_valid_days || self.pos.config.default_return_valid_days,
                            });
                        } else if(category && category.return_valid_days < 1){
                            var temp = self.find_parent_category(category);
                            order_category_list.push(temp);
                        }
                    } else {
                        order_category_list.push({
                            "id": self.pos.db.root_category_id,
                            "name": "others",
                            "return_valid_days": self.pos.config.default_return_valid_days,
                        });
                    }
                });
                this.final_order_category_list = _.uniq(order_category_list, function(item){
                    return item.id;
                });
            }
            if(self.pos.config.enable_gift_voucher){
                if(order.get_voucher()){
                    var voucher_use = _.countBy(vouchers, 'voucher_code');
                    _.each(vouchers, function(voucher){
                        if(_.where(counter, {voucher_code: voucher.voucher_code}).length < 1){
                            counter.push({
                                voucher_name : voucher.display_name,
                                voucher_code: voucher.voucher_code,
                                remaining_redeemption: voucher.redemption_customer - (voucher.already_redeemed > 0 ? voucher.already_redeemed + voucher_use[voucher.voucher_code] : voucher_use[voucher.voucher_code]),
                            });
                        }
                    });
                    order.set_remaining_redeemption(counter);
                }
            }
            this._super();
            if( barcode_val && barcode_val[0]){
                var barcode = barcode_val[0].giftcard_card_no;
                $("tr#barcode_giftcard").html($("<td style='padding:2px 2px 2px 38px; text-align:center;'><div class='" + barcode + "' width='150' height='50' /></td>"));
                $("." + barcode.toString()).barcode(barcode.toString(), "code128");
                $("td#barcode_val_giftcard").html(barcode);
            }
            var barcode_recharge_val = order.get_recharge_giftcard();
            if( barcode_recharge_val && barcode_recharge_val[0]){
                var barcode = barcode_recharge_val[0].recharge_card_no;
                $("tr#barcode_recharge").html($("<td style='padding:2px 2px 2px 38px; text-align:center;'><div class='" + barcode + "' width='150' height='50' /></td>"));
                $("." + barcode.toString()).barcode(barcode.toString(), "code128");
                $("td#barcode_val_recharge").html(barcode);
            }
            var barcode_free_val = order.get_free_data();
            if( barcode_free_val){
                var barcode = barcode_free_val.giftcard_card_no;
                $("tr#barcode_free").html($("<td style='padding:2px 2px 2px 38px; text-align:center;'><div class='" + barcode + "' width='150' height='50' /></td>"));
                $("." + barcode.toString()).barcode(barcode.toString(), "code128");
                $("td#barcode_val_free").html(barcode);
            }

            var barcode_redeem_val = order.get_redeem_giftcard();
            if( barcode_redeem_val && barcode_redeem_val[0]){
                var barcode = barcode_redeem_val[0].redeem_card;
                $("tr#barcode_redeem").html($("<td style='padding:2px 2px 2px 38px; text-align:center;'><div class='" + barcode + "' width='150' height='50' /></td>"));
                $("." + barcode.toString()).barcode(barcode.toString(), "code128");
                $("td#barcode_val_redeem").html(barcode);
            }
        },
        find_parent_category: function(category){
            var self = this;
            if (category){
                if(!category.parent_id){
                    return {
                        "id": category.id,
                        "name": category.name,
                        "return_valid_days": category.return_valid_days || self.pos.config.default_return_valid_days,
                    };
                }
                if(category.return_valid_days > 0){
                    return {
                        "id": category.id,
                        "name": category.name,
                        "return_valid_days": category.return_valid_days || self.pos.config.default_return_valid_days,
                    };
                } else {
                    category = self.pos.db.get_category_by_id(category.parent_id[0]);
                    return self.find_parent_category(category)
                }
            }
        },
    	render_receipt: function() {
    		var order = this.pos.get_order();
            if (order.get_free_data()){
                this.$('.pos-receipt-container').html(QWeb.render('FreeTicket',{
                    widget:this,
                    order: order,
                }));
            }else if(order.get_receipt()){
            	var no = $('input#no_of_copies').val()
            	var category_data = '';
	        	var order_data = '';
	        	var payment_data = '';
	        	if(Object.keys(order.get_order_list().order_report).length == 0 ){
	        		order_data = false;
	        	}else{
	        		order_data = order.get_order_list()['order_report']
	        	}
	        	if(Object.keys(order.get_order_list().category_report).length == 0 ){
	        		category_data = false;
	        	}else{
	        		category_data = order.get_order_list()['category_report']
	        	}
	        	if(Object.keys(order.get_order_list().payment_report).length == 0 ){
	        		payment_data = false;
	        	}else{
	        		payment_data = order.get_order_list()['payment_report']
	        	}
	        	var receipt = "";
	        	for(var i=0;i < no;i++){
	        		receipt += QWeb.render('CustomTicket',{
		                widget:this,
		                order: order,
		                receipt: order.export_for_printing(),
		                order_report : order_data,
		        		category_report : category_data,
		        		payment_report : payment_data
		            })
	        	}
	        	this.$('.pos-receipt-container').html(receipt);
            } else if(order.get_order_summary_report_mode()){
            	var no = $('#no_of_summary').val();
            	var product_summary_key = Object.keys(order.get_product_summary_report()['product_summary'] ? order.get_product_summary_report()['product_summary'] :false );
	            if(product_summary_key.length > 0){
	            	var product_summary_data = order.get_product_summary_report()['product_summary'];
	            } else {
	            	var product_summary_data = false;
	            }
	            var category_summary_key = Object.keys(order.get_product_summary_report()['category_summary']);
	             if(category_summary_key.length > 0){
	            	var category_summary_data = order.get_product_summary_report()['category_summary'];
	            } else {
	            	var category_summary_data = false;
	            }
	             var payment_summary_key = Object.keys(order.get_product_summary_report()['payment_summary']);
	             if(payment_summary_key.length > 0){
	            	 var payment_summary_data = order.get_product_summary_report()['payment_summary'];
	            } else {
	            	var payment_summary_data = false;
	            }
	            var location_summary_key = Object.keys(order.get_product_summary_report()['location_summary']);
	             if(location_summary_key.length > 0){
	            	 var location_summary_data = order.get_product_summary_report()['location_summary'];
	            } else {
	            	var location_summary_data = false;
	            }
	            var receipt = "";
	            for (var step = 0; step < no; step++) {
	                receipt += QWeb.render('ProductSummaryReport',{
	                    widget:this,
	                    order: order,
	                    receipt: order.export_for_printing(),
	                    product_details: product_summary_data,
	                    category_details: category_summary_data,
	                    payment_details: payment_summary_data,
	                    location_details:location_summary_data,
	                })
	            }
	            this.$('.pos-receipt-container').html(receipt);
            } else if(order.get_sales_summary_mode()) {
            	var journal_key = Object.keys(order.get_sales_summary_vals()['journal_details']);
	            if(journal_key.length > 0){
	            	var journal_summary_data = order.get_sales_summary_vals()['journal_details'];
	            } else {
	            	var journal_summary_data = false;
	            }
	            var sales_key = Object.keys(order.get_sales_summary_vals()['salesmen_details']);
	            if(sales_key.length > 0){
	            	var sales_summary_data = order.get_sales_summary_vals()['salesmen_details'];
	            } else {
	            	var sales_summary_data = false;
	            }
	            var total = Object.keys(order.get_sales_summary_vals()['summary_data']);
	            if(total.length > 0){
	            	var total_summary_data = order.get_sales_summary_vals()['summary_data'];
	            } else {
	            	var total_summary_data = false;
	            }
	            var receipt = "";
	            receipt = QWeb.render('PaymentSummaryReport',{
	                widget:this,
	                order: order,
	                receipt: order.export_for_printing(),
	                journal_details: journal_summary_data,
	                salesmen_details: sales_summary_data,
	                total_summary : total_summary_data
	            })
	            this.$('.pos-receipt-container').html(receipt);
            } else if(order.get_receipt_mode()){
                var data = order.get_product_vals();
                var receipt = "";
                receipt = QWeb.render('OutStockPosReport',{
                    widget:this,
                    order: order,
                    receipt: order.export_for_printing(),
                    location_data: order.get_location_vals(),
                    product_data: data,
                })
                this.$('.pos-receipt-container').html(receipt);
            } else if(order.get_money_inout_details()){
                $('.pos-receipt-container', this.$el).html(QWeb.render('MoneyInOutTicket',{
                   widget:this,
                   order: order,
                   money_data: order.get_money_inout_details(),
                }));
            } else if(order.get_cash_register()){
                $('.pos-receipt-container', this.$el).html(QWeb.render('CashInOutStatementReceipt',{
                    widget:this,
                    order: order,
                    statements: order.get_cash_register(),
                }));
            } else{
                this.$('.pos-receipt-container').html(QWeb.render('PosTicket',{
                    widget:this,
                    order: order,
                    receipt: order.export_for_printing(),
                    orderlines: order.get_orderlines(),
                    paymentlines: order.get_paymentlines(),
                }));
            }
            var barcode_val = this.pos.get_order().get_name();
            if (barcode_val.indexOf(_t("Order ")) != -1) {
                var vals = barcode_val.split(_t("Order "));
                if (vals) {
                    var barcode = vals[1];
                    $("tr#barcode1").html($("<td style='padding:2px 2px 2px 0px; text-align:center;'><div class='" + barcode + "' width='150' height='50'/></td>"));
                    $("." + barcode.toString()).barcode(barcode.toString(), "code128");
                }
            }
        },
        render_change: function() {
        	this._super();
            this.$('.total-value').html(this.format_currency(this.pos.get_order().getNetTotalTaxIncluded()));
        },
        print_xml: function() {
            var order = this.pos.get_order();
            var env = {
                widget:  this,
                pos: this.pos,
                order: this.pos.get_order(),
                receipt: this.pos.get_order().export_for_printing(),
                paymentlines: this.pos.get_order().get_paymentlines()
            };
            if(order.get_free_data()){
                var receipt = QWeb.render('XmlFreeTicket',env);
            } else{
                var receipt = QWeb.render('XmlReceipt',env);
            }
            this.pos.proxy.print_receipt(receipt);
            this.pos.get_order()._printed = true;
        },
        renderElement: function() {
            var self = this;
            this._super();
            var customer_display = this.pos.config.customer_display;
            this.$('.next').click(function(){
            	if(self.pos.get_order()){
            		if(customer_display){
            			self.pos.get_order().mirror_image_data();
            		}
            	}
            });
        },
    });

    screens.NumpadWidget.include({
        start: function() {
            var self = this;
            this._super();
            var customer_display = this.pos.config.customer_display;
            this.$(".input-button").click(function(){
            	if(customer_display){
            		self.pos.get_order().mirror_image_data();
            	}
            });
        },
    });

    /* Order list screen */
	var OrderListScreenWidget = screens.ScreenWidget.extend({
	    template: 'OrderListScreenWidget',

	    init: function(parent, options){
	    	var self = this;
	        this._super(parent, options);
	        this.reload_btn = function(){
	        	$('.reload_order').toggleClass('rotate', 'rotate-reset');
	        	self.reloading_orders();
	        };
	        if(this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard){
            	self.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
	    },
	    events: {
	    	'click .button.back':  'click_back',
	    	'keyup .searchbox input': 'search_order',
	    	'click .searchbox .search-clear': 'clear_search',
	        'click .button.draft':  'click_draft',
	        'click .button.paid': 'click_paid',
	        'click .button.posted': 'click_posted',
	        'click #print_order': 'click_reprint',
//	        'click #view_lines': 'click_view_lines',
	        'click #edit_order': 'click_edit_order',
	        'click #re_order_duplicate': 'click_duplicate_order',
	        
	        //reservation
	        'click .button.reserved':  'click_reserved',
	        'click .order-line td:not(.order_history_button)': 'click_order_line',
	        'click #pay_due_amt': 'pay_order_due',
	        'click #cancel_order': 'click_cancel_order',
	        'click #delivery_date': 'click_delivery_date',
	    },
	    filter:"all",
        date: "all",
        get_orders: function(){
        	return this.pos.get('pos_order_list');
        },
        click_back: function(){
        	this.gui.show_screen('products');
        },
        click_draft: function(event){
        	var self = this;
        	if($(event.currentTarget).hasClass('selected')){
        		$(event.currentTarget).removeClass('selected');
        		self.filter = "all";
    		}else{
        		self.$('.button.paid').removeClass('selected');
        		self.$('.button.posted').removeClass('selected');
        		self.$('.button.reserved').removeClass('selected');
    			$(event.currentTarget).addClass('selected');
        		self.filter = "draft";
    		}
    		self.render_list(self.get_orders());
        },
        click_paid: function(event){
        	var self = this;
        	if($(event.currentTarget).hasClass('selected')){
        		$(event.currentTarget).removeClass('selected');
        		self.filter = "all";
    		}else{
        		self.$('.button.draft').removeClass('selected');
        		self.$('.button.posted').removeClass('selected');
        		self.$('.button.reserved').removeClass('selected');
        		$(event.currentTarget).addClass('selected');
        		self.filter = "paid";
    		}
        	self.render_list(self.get_orders());
        },
        click_posted: function(event){
        	var self = this;
        	if($(event.currentTarget).hasClass('selected')){
        		$(event.currentTarget).removeClass('selected');
        		self.filter = "all";
    		}else{
    			self.$('.button.paid').removeClass('selected');
    			self.$('.button.draft').removeClass('selected');
    			self.$('.button.reserved').removeClass('selected');
    			$(event.currentTarget).addClass('selected');
        		self.filter = "done";
    		}
        	self.render_list(self.get_orders());
        },
        click_reserved: function(event){
	    	var self = this;
        	if($(event.currentTarget).hasClass('selected')){
        		$(event.currentTarget).removeClass('selected');
        		self.filter = "all";
    		}else{
    			self.$('.button.paid').removeClass('selected');
        		self.$('.button.posted').removeClass('selected');
        		self.$('.button.draft').removeClass('selected');
    			$(event.currentTarget).addClass('selected');
        		self.filter = "reserved";
    		}
    		self.render_list(self.get_orders());
	    },
        click_order_line: function(event){
	    	var self = this;
	    	var order_id = parseInt($(event.currentTarget).parent().data('id'));
	    	if(order_id){
	    		self.gui.show_screen('orderdetail', {'order_id': order_id});
	    	}
	    },
	    click_cancel_order: function(event){
	    	var self = this;
	    	var order_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_order_by_id(order_id);
            if(result){
            	self.gui.show_popup("cancel_order_popup", { 'order': result });
            }
	    },
	    click_delivery_date: function(event){
	    	var self = this;
	    	var order = self.pos.get_order();
            var order_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_order_by_id(order_id);
            if(result){
	            order.set_delivery_date(result.delivery_date);
	            self.gui.show_popup("delivery_date_popup", { 'order': result, 'new_date': false });
            }
	    },
	    pay_order_due: function(event, order_id){
	        var self = this;
	        var order_id = event ? parseInt($(event.currentTarget).data('id')) : order_id;
	        var result = self.pos.db.get_order_by_id(order_id);
	        if(!result){
	        	var params = {
                	model: 'pos.order',
                	method: 'ac_pos_search_read',
                	args: [{ 'domain': [['id', '=', order_id]] }],
                }
	        	rpc.query(params, {async: false})
	            .then(function(order){
	                if(order && order[0]){
	                    result = order[0]
	                }
	            });
	        }
            if(result.state == "paid"){
                return
            }
            if(result.state == "done"){
                return
            }
            if (result && result.lines.length > 0) {
                var count = 0;
                var selectedOrder = self.pos.get_order();
                selectedOrder.empty_cart();
                if (result.partner_id && result.partner_id[0]) {
                    var partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                    if(partner){
                    	selectedOrder.set_client(partner);
                    }
                }
                if(!result.partial_pay){
                    selectedOrder.set_reservation_mode(true);
                }
                selectedOrder.set_delivery_date(result.delivery_date);
                selectedOrder.set_pos_reference(result.pos_reference);
                selectedOrder.set_paying_due(true);
                selectedOrder.set_reserve_delivery_date(result.reserve_delivery_date || false);
                selectedOrder.set_order_note(result.note || '');
                if (result.lines) {
                		var params = {
                			model: 'pos.order.line',
                			method: 'search_read',
                			domain: [['id', 'in',result.lines]],
                		}
                		rpc.query(params, {async: false})
                        .then(function(results) {
                             if(results){
                                 _.each(results, function(res) {
                                     var product = self.pos.db.get_product_by_id(Number(res.product_id[0]));
                                     if(product){
                                         var line = new models.Orderline({}, {pos: self.pos, order: selectedOrder, product: product});
                                         line.set_discount(res.discount);
                                         line.set_quantity(res.qty);
                                         line.set_unit_price(res.price_unit);
                                         selectedOrder.add_orderline(line);
                                         selectedOrder.select_orderline(selectedOrder.get_last_orderline());
                                     }
                                 });
                                var prd = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                                if(prd && result.amount_due > 0){
                                    var paid_amt = result.amount_total - result.amount_due;
                                    selectedOrder.set_amount_paid(paid_amt);
                                    selectedOrder.add_product(prd,{'quantity': -1, 'price': paid_amt});
                                }
                                self.gui.show_screen('payment');
                             }
                        });
                     selectedOrder.set_order_id(order_id);
                }
                selectedOrder.set_sequence(result.name);
            }
	    },
        show: function(){
        	var self = this;
	        this._super();
	        this.reload_orders();
	        $('input#datepicker').datepicker({
           	    dateFormat: 'yy-mm-dd',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function (dateText, inst) {
                	var date = $(this).val();
					if (date){
					    self.date = date;
					    self.render_list(self.get_orders());
					}
				},
				onClose: function(dateText, inst){
                    if( !dateText ){
                        self.date = "all";
                        self.render_list(self.get_orders());
                    }
                }
           }).focus(function(){
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.date = "all";
                    self.render_list(self.get_orders());
                });
           });
	       $('.button.paid').removeClass('selected').trigger('click');
	    },
	    get_journal_from_order: function(statement_ids){
	    	var self = this;
	    	var order = this.pos.get_order();
	    	var params = {
	    		model: 'account.bank.statement.line',
	    		method: 'search_read',
	    		domain: [['id', 'in', statement_ids]],
	    	}
	    	rpc.query(params, {async: false}).then(function(statements){
	    		if(statements.length > 0){
	    			var order_statements = []
	    			_.each(statements, function(statement){
	    				if(statement.amount > 0){
	    					order_statements.push({
	    						amount: statement.amount,
	    						journal: statement.journal_id[1],
	    					})
	    				}
	    			});
	    			order.set_journal(order_statements);
	    		}
	    	}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
	    },
	    get_orderlines_from_order: function(line_ids){
	    	var self = this;
	    	var order = this.pos.get_order();
	    	var orderlines = false;
	    	var params = {
	    		model: 'pos.order.line',
	    		method: 'search_read',
	    		domain: [['id', 'in', line_ids]],
	    	}
	    	rpc.query(params, {async: false}).then(function(order_lines){
	    		if(order_lines.length > 0){
	    			orderlines = order_lines;
	    		}
	    	}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
	    	return orderlines
	    },
	    click_reprint: function(event){
        	var self = this;
        	var selectedOrder = this.pos.get_order();
        	var order_id = parseInt($(event.currentTarget).data('id'));
        	
        	selectedOrder.destroy();
        	var selectedOrder = this.pos.get_order();
        	var result = self.pos.db.get_order_by_id(order_id);
        	if (result && result.lines.length > 0) {
        		if (result.partner_id && result.partner_id[0]) {
                    var partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                    if(partner){
                    	selectedOrder.set_client(partner);
                    }
                }
        		selectedOrder.set_amount_paid(result.amount_paid);
                selectedOrder.set_amount_return(Math.abs(result.amount_return));
                selectedOrder.set_amount_tax(result.amount_tax);
                selectedOrder.set_amount_total(result.amount_total);
                selectedOrder.set_company_id(result.company_id[1]);
                selectedOrder.set_date_order(result.date_order);
                selectedOrder.set_pos_reference(result.pos_reference);
                selectedOrder.set_user_name(result.user_id && result.user_id[1]);
                if(result.statement_ids.length > 0){
                	self.get_journal_from_order(result.statement_ids);
                }
                if(result.lines.length > 0){
                	var order_lines = self.get_orderlines_from_order(result.lines);
                	if(order_lines.length > 0){
	                	_.each(order_lines, function(line){
		    				var product = self.pos.db.get_product_by_id(Number(line.product_id[0]));
		    				if(product){
		    					selectedOrder.add_product(product, {
		    						quantity: line.qty,
		    						discount: line.discount,
		    						price: line.price_unit,
		    					})
		    				}
		    			})
                	}
                }
                selectedOrder.set_order_id(order_id);
                self.gui.show_screen('receipt');
        	}
        },
//        click_view_lines: function(event){
//        	var self = this;
//        	var order_id = parseInt($(event.currentTarget).data('id'));
//            var order = this.pos.get_order();
//            var result = self.pos.db.get_order_by_id(order_id);
//            if(result.lines.length > 0){
//            	var order_lines = self.get_orderlines_from_order(result.lines);
//            	if(order_lines){
//            		self.gui.show_popup('product_popup', {
//            			order_lines: order_lines,
//            			order_id: order_id,
//            			state: result.state,
//            			order_screen_obj: self,
//            		});
//            	}
//            }
//        },
        click_duplicate_order: function(event){
        	var self = this;
        	var order_id = parseInt($(event.currentTarget).data('id'));
        	var selectedOrder = this.pos.get_order();
            var result = self.pos.db.get_order_by_id(order_id);
            var gift_card_product_id = self.pos.config.gift_card_product_id[0] || false;
            if(result.lines.length > 0){
            	var order_lines = self.get_orderlines_from_order(result.lines);
            	if(order_lines && order_lines[0]){
            		var valid_product = false;
            		order_lines.map(function(line){
            			if(line.product_id && line.product_id[0]){
            				var product = self.pos.db.get_product_by_id(line.product_id[0]);
            				if((product && !product.is_dummy_product) && (line.line_status != 'full')){
            					valid_product = true;
            				}
            			}
            		});
            		if(valid_product){
            			self.gui.show_popup('duplicate_product_popup',{
                			order_lines:order_lines,
                			'old_order':result,
    					});
            		}else{
            			self.pos.db.notification('danger',_t("Products is not valid for reorder."));
            		}
            	}
            }
        },
        click_edit_order: function(event){
        	var self = this;
        	var order_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_order_by_id(order_id);
            if(result.lines.length > 0){
            	if($(event.currentTarget).data('operation') === "edit"){
	            	if(result.state == "paid"){
	            		self.pos.db.notification('danger',_t('This order is paid'));
	                	return
	                }
	                if(result.state == "done"){
	                	self.pos.db.notification('danger',_t('This order is done'));
	                	return
	                }
            	}
            	var selectedOrder = this.pos.get_order();
            	selectedOrder.destroy();
            	var selectedOrder = this.pos.get_order();
            	if (result.partner_id && result.partner_id[0]) {
                    var partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                    if(partner){
                    	selectedOrder.set_client(partner);
                    }
                }
            	if($(event.currentTarget).data('operation') !== "reorder"){
	           	 	selectedOrder.set_pos_reference(result.pos_reference);
	           	 	selectedOrder.set_order_id(order_id);
	           	 	selectedOrder.set_sequence(result.name);
            	}
            	var delivery_mode = false;
            	var delivery_charges = 0;
	           	if(result.lines.length > 0){
	            	var order_lines = self.get_orderlines_from_order(result.lines);
	            	if(order_lines.length > 0){
		               	_.each(order_lines, function(line){
			    			var product = self.pos.db.get_product_by_id(Number(line.product_id[0]));
                            if(line.deliver){
                            	delivery_mode = true;
			    			}
			    			if(delivery_mode && product.id == self.pos.config.delivery_product_id[0]){
			    				delivery_charges = line.price_unit;
			    			}
			    			if(product && product.id != self.pos.config.delivery_product_id[0]){
			    				selectedOrder.add_product(product, {
			    					quantity: line.qty,
			    					discount: line.discount,
			    					price: line.price_unit,
			    				});
			    				var selected_orderline = selectedOrder.get_selected_orderline();
			    				if(line.deliver){
			    					selected_orderline.set_deliver_info(true);
			    				}
			    				if(product.is_packaging){
			    					selected_orderline.set_bag_color(true);
			    					selected_orderline.set_is_bag(true);
			    				}
			    			}
			    		})
	            	}
	            }
	           	self.gui.show_screen('products');
                if(delivery_mode){
                    var deliver_product_id = self.pos.config.delivery_product_id[0];
                    var deliver_amt = self.pos.config.delivery_amount;
                    var product = self.pos.db.get_product_by_id(deliver_product_id);
                    if(product){
                    	var line_deliver_charges = new models.Orderline({}, 
                                      {pos: self.pos, order:selectedOrder, product: product});
                        line_deliver_charges.set_quantity(1);
                        line_deliver_charges.set_unit_price(delivery_charges);
                        line_deliver_charges.set_delivery_charges_color(true);
                        line_deliver_charges.set_delivery_charges_flag(true);
                        selectedOrder.add_orderline(line_deliver_charges);
                        selectedOrder.set_is_delivery(true);
                   }
                   selectedOrder.set_delivery(true);
                   $('#delivery_mode').addClass('deliver_on');
               }
            }
        },
	    search_order: function(event){
	    	var self = this;
	    	var search_timeout = null;
	    	clearTimeout(search_timeout);
            var query = $(event.currentTarget).val();
            search_timeout = setTimeout(function(){
                self.perform_search(query,event.which === 13);
            },70);
	    },
	    perform_search: function(query, associate_result){
	    	var self = this;
            if(query){
                var orders = this.pos.db.search_order(query);
                if ( associate_result && orders.length === 1){
                    this.gui.back();
                }
                this.render_list(orders);
            }else{
                var orders = self.pos.get('pos_order_list');
                this.render_list(orders);
            }
        },
        clear_search: function(){
            var orders = this.pos.get('pos_order_list');
            this.render_list(orders);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        check_filters: function(orders){
        	var self = this;
        	var filtered_orders = false;
        	if(self.filter == 'reserved'){
        		filtered_orders = $.grep(orders,function(order){
	            	return order.reserved;
	            });
        	}
        	if(self.filter !== "" && self.filter !== "all" && self.filter !== 'reserved'){
	            filtered_orders = $.grep(orders,function(order){
	            	return order.state === self.filter && !order.reserved;
	            });
            }
        	return filtered_orders || orders;
        },
        check_date_filter: function(orders){
        	var self = this;
        	var date_filtered_orders = [];
        	if(self.date !== "" && self.date !== "all"){
            	
            	for (var i=0; i<orders.length;i++){
                    var date_order = $.datepicker.formatDate("yy-mm-dd",new Date(orders[i].date_order));
            		if(self.date === date_order){
            			date_filtered_orders.push(orders[i]);
            		}
            	}
            }
        	return date_filtered_orders;
        },
	    render_list: function(orders){
        	var self = this;
        	if(orders){
	            var contents = this.$el[0].querySelector('.order-list-contents');
	            contents.innerHTML = "";
	            var temp = [];
	            orders = self.check_filters(orders);
	            if(self.date !== "" && self.date !== "all"){
	            	orders = self.check_date_filter(orders);
	            }
	            for(var i = 0, len = Math.min(orders.length,1000); i < len; i++){
	                var order    = orders[i];
	                var orderlines = [];
	                order.amount_total = parseFloat(order.amount_total).toFixed(2);
//	                var params = {
//        	    		model: 'pos.order.line',
//        	    		method: 'search_read',
//        	    		domain: [['id', 'in', order.lines]],
//        	    	}
//        	    	rpc.query(params, {async: false}).then(function(order_lines){
//        	    		if(order_lines.length > 0){
//        	    			orderlines = order_lines;
//        	    		}
//        	    	});
	            	var clientline_html = QWeb.render('OrderlistLine',{widget: this, order:order, orderlines:orderlines});
	                var clientline = document.createElement('tbody');
	                clientline.innerHTML = clientline_html;
	                clientline = clientline.childNodes[1];
	                contents.appendChild(clientline);
	            }
	            $("table.order-list").simplePagination({
					previousButtonClass: "btn btn-danger",
					nextButtonClass: "btn btn-danger",
					previousButtonText: '<i class="fa fa-angle-left fa-lg"></i>',
					nextButtonText: '<i class="fa fa-angle-right fa-lg"></i>',
					perPage:self.pos.config.record_per_page > 0 ? self.pos.config.record_per_page : 10
				});
        	}
        },
        reload_orders: function(){
        	var self = this;
            var orders=self.pos.get('pos_order_list');
            this.render_list(orders);
        },
	    reloading_orders: function(){
	    	var self = this;
	    	var date = new Date();
	    	var params = {
				model: 'pos.order',
				method: 'ac_pos_search_read',
				args: [{'domain': this.pos.domain_as_args}],
			}
			return rpc.query(params, {async: false}).then(function(orders){
                if(orders.length > 0){
                	self.pos.db.add_orders(orders);
                    self.pos.set({'pos_order_list' : orders});
                    self.reload_orders();
                }
            }).fail(function (type, error){
                if( error.data && error.code === 200 ){    // Business Logic Error, not a connection problem
                   self.gui.show_popup('error-traceback',{
                        'title': error.data.message,
                        'body':  error.data.debug
                   });
                } else {
                	self.pos.db.notification('danger','Connection lost');
                }
            });
	    },
	    renderElement: function(){
	    	var self = this;
	    	self._super();
	    	self.el.querySelector('.button.reload').addEventListener('click',this.reload_btn);
	    },
	});
	gui.define_screen({name:'orderlist', widget: OrderListScreenWidget});

	var GraphScreenWidget = screens.ScreenWidget.extend({
	    template: 'GraphScreenWidget',
	    init: function(parent, options){
	        this._super(parent, options);
	        this.bar_chart = function(){
	        	var self = this;
	        	var order = self.pos.get_order();
	        	var data = order.get_result();
	        	var dps = [];
        		if(data){
	        		for(var i=0;i<data.length;i++){
		        		dps.push({label: data[i][0], y: data[i][1]});
		        	}
	        	}
        		var symbol = false;
        		if($('#top_products').hasClass('menu_selected')){
        			symbol = 'Qty-#######.00';
        		}else{
        			symbol = self.pos.currency.symbol ? self.pos.currency.symbol+"#######.00" : false;
        		}
	    		var chart = new CanvasJS.Chart("chartContainer",{
	    			width: data && data.length > 10 ? 1200 : 0,
	    			dataPointMaxWidth:25,
	    			zoomEnabled:true,
	    			exportFileName: $('a.menu_selected').text(),
	    			exportEnabled: true,
	    			theme: "theme3",
	    			title: {
	    				text: $('a.menu_selected').text()
	    			},
	    			axisY: {
	    				suffix: ""
	    			},		
	    			legend :{
	    				verticalAlign: 'bottom',
	    				horizontalAlign: "center"
	    			},
	    			data: [{
	    				type: "column",
	    				bevelEnabled: true,
	    				indexLabel:'{y}',
	    				indexLabelOrientation: "vertical", //horizontal
	    				yValueFormatString:symbol || '',
	    				dataPoints: dps
	    			}]
	    		});
	    		chart.render();
	        };
	        this.pie_chart = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_result();
	        	var dps = [];
	        	for(var i=0;i<data.length;i++){
	        		dps.push({y: data[i][1], indexLabel: data[i][0]});
	        	}
	        	var chart = new CanvasJS.Chart("chartContainer",
    			{
	        		exportFileName: $('a.menu_selected').text(),
	    			exportEnabled: true,
	    			zoomEnabled:true,
    				theme: "theme2",
    				title:{
    					text: $('a.menu_selected').text()
    				},
    				data: [{
    					type: "pie",
    					showInLegend: true,
    					toolTipContent: "{y} - #percent %",
    					yValueFormatString: "",
    					legendText: "{indexLabel}",
    					dataPoints: dps
    				}]
    			});
    			chart.render();
	        };
	    },
	    filter:"all",
        date: "all",
        show: function(){
        	var self = this;
        	this._super();
        	$('#duration_selection').prop('selectedIndex',1);
        	$("#start_date").val('');
        	$("#end_date").val('');
        	var from = false;
        	var to = false;
//        	if($('#duration_selection').val() != "nofilter"){
        		from = moment(new Date()).locale("en").format('YYYY-MM-DD')+" 00:00:00";
        		to = moment(new Date()).locale("en").format('YYYY-MM-DD HH:mm:ss');
//        	}
        	var active_chart = $('span.selected_chart').attr('id');
        	var category = $('a.menu_selected').attr('id');
        	var limit = $('#limit_selection').val() || 10;
        	self.graph_data(from, to, active_chart, category, limit);
        	self.bar_chart();
        },
	    start: function(){
	    	var self = this;
            this._super();
            var active_chart = $('span.selected_chart').attr('id');
        	var category = $('a.menu_selected').attr('id');
            var from;
    		var to;
    		var limit = $('#limit_selection').val() || 10;
    		$("#start_date").datepicker({
    			dateFormat: 'yy-mm-dd',
    			onSelect: function(dateText, inst) {
    				active_chart = $('span.selected_chart').attr('id');
    				category = $('a.menu_selected').attr('id');
    		        from = dateText + ' 00:00:00';
    		        to = $("#end_date").val() ? to : false;
    		        limit = $('#limit_selection').val() || 10;
    		        $('#duration_selection').prop('selectedIndex',0);
    		        self.graph_data(from, to, active_chart, category, limit);
    		    },
    		});
    		$("#end_date").datepicker({
    			dateFormat: 'yy-mm-dd',
    			onSelect: function(dateText, inst) {
    				active_chart = $('span.selected_chart').attr('id');
    				category = $('a.menu_selected').attr('id');
    				from = $("#start_date").val() ? from : false;
    		        to = dateText + ' 23:59:59';
    		        limit = $('#limit_selection').val() || 10;
    		        $('#duration_selection').prop('selectedIndex',0);
    		        self.graph_data(from, to, active_chart, category, limit);
    		    },
    		});
            this.$('.back').click(function(){
                self.gui.back();
            });

            this.$('#duration_selection').on('change',function(){
            	$("#start_date").val('');
            	$("#end_date").val('');
            	self.get_graph_information();
            });
            this.$('#limit_selection').on('change',function(){
            	self.get_graph_information();
            });

            this.$('#top_customer').click(function(){
            	if(!$('#top_customer').hasClass('menu_selected')){
            		$('#top_customer').addClass('menu_selected');
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
            		if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#top_products').click(function(){
            	if(!$('#top_products').hasClass('menu_selected')){
            		$('#top_products').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
            		if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#cashiers').click(function(){
            	if(!$('#cashiers').hasClass('menu_selected')){
            		$('#cashiers').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#sales_by_location').click(function(){
            	if(!$('#sales_by_location').hasClass('menu_selected')){
            		$('#sales_by_location').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
        			if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#income_by_journals').click(function(){
            	if(!$('#income_by_journals').hasClass('menu_selected')){
            		$('#income_by_journals').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
        			if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#top_category').click(function(){
            	if(!$('#top_category').hasClass('menu_selected')){
            		$('#top_category').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
            		if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#pos_benifit').hasClass('menu_selected')){
            			self.$('#pos_benifit').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });
            this.$('#pos_benifit').click(function(){
            	if(!$('#pos_benifit').hasClass('menu_selected')){
            		$('#pos_benifit').addClass('menu_selected');
            		if(self.$('#top_customer').hasClass('menu_selected')){
            			self.$('#top_customer').removeClass('menu_selected');
            		}
            		if(self.$('#top_products').hasClass('menu_selected')){
            			self.$('#top_products').removeClass('menu_selected');
            		}
            		if(self.$('#cashiers').hasClass('menu_selected')){
            			self.$('#cashiers').removeClass('menu_selected');
            		}
        			if(self.$('#sales_by_location').hasClass('menu_selected')){
            			self.$('#sales_by_location').removeClass('menu_selected');
            		}
        			if(self.$('#income_by_journals').hasClass('menu_selected')){
            			self.$('#income_by_journals').removeClass('menu_selected');
            		}
        			if(self.$('#top_category').hasClass('menu_selected')){
            			self.$('#top_category').removeClass('menu_selected');
            		}
            	}
            	self.get_graph_information();
            });

            /*Bar Chart*/
            this.$('#bar_chart').click(function(){
            	var order = self.pos.get_order();
            	if($('#bar_chart').hasClass('selected_chart')){
//            		$('#bar_chart').removeClass('selected_chart');
//            		$('#chartContainer').html('');
            	}else{
            		$('#bar_chart').addClass('selected_chart');
        			if(self.$('#pie_chart').hasClass('selected_chart')){
            			self.$('#pie_chart').removeClass('selected_chart');
            		}
        			self.get_graph_information();
                	self.bar_chart();
            	}
            });
            /*Pie Chart*/
            this.$('#pie_chart').click(function(){
            	if($('#pie_chart').hasClass('selected_chart')){
//            		$('#pie_chart').removeClass('selected_chart');
//            		$('#chartContainer').html('');
            	}else{
            		$('#pie_chart').addClass('selected_chart');
        			if(self.$('#bar_chart').hasClass('selected_chart')){
            			self.$('#bar_chart').removeClass('selected_chart');
            		}
        			self.get_graph_information();
        			self.pie_chart();
            	}
            });
	    },
	    graph_data: function(from, to, active_chart, category, limit){
	    	var self = this;
	    	var current_session_report = self.pos.config.current_session_report;
	    	var records = rpc.query({
                model: 'pos.order',
                method: 'graph_data',
                args: [from, to, category, limit, self.pos.pos_session.id, current_session_report],
            });
            records.then(function(result){
            	var order = self.pos.get_order();
            	var dummy_product_ids = self.pos.db.get_dummy_product_ids();
				if(result){
					if(result.length > 0){
						if(category == "top_products"){
							var new_data = [];
							result.map(function(data){
								if(($.inArray(data[1], dummy_product_ids) == -1)){
									new_data.push(data);
								}
							});
							order.set_result(new_data);
						}else{
							order.set_result(result);
						}
					}else{
						order.set_result(0);
					}
				}else{
					order.set_result(0);
				}
				if(active_chart == "bar_chart"){
            		self.bar_chart();
            	}
				if(active_chart == "pie_chart"){
            		self.pie_chart();
            	}
			}).fail(function(error, event) {
				if (error.code === -32098) {
					self.pos.db.notification('danger',_t("Connectin Lost"));
					event.preventDefault();
				}
            });
	    },
	    get_graph_information: function(){
	    	var self = this;
	    	var time_period = $('#duration_selection').val();
    		var active_chart = $('span.selected_chart').attr('id');
        	var category = $('a.menu_selected').attr('id');
        	var limit = $('#limit_selection').val() || 10;
        	if(time_period == "today"){
        		var from = moment(new Date()).locale("en").format('YYYY-MM-DD')+" 00:00:00";
        		var to = moment(new Date()).locale("en").format('YYYY-MM-DD HH:mm:ss');
        		self.graph_data(from, to, active_chart, category, limit);
        	}else if(time_period == "week"){
        		var from = moment(moment().startOf('week').toDate()).locale("en").format('YYYY-MM-DD')+" 00:00:00";
        		var to   = moment(moment().endOf('week').toDate()).locale("en").format('YYYY-MM-DD')+" 23:59:59";
        		self.graph_data(from, to, active_chart, category, limit);
        	}else if(time_period == "month"){
        		var from = moment(moment().startOf('month').toDate()).locale("en").format('YYYY-MM-DD')+" 00:00:00";
        		var to   = moment(moment().endOf('month').toDate()).locale("en").format('YYYY-MM-DD')+" 23:59:59";
        		self.graph_data(from, to, active_chart, category, limit);
        	}else{
        		var from = $('#start_date').val() ? $('#start_date').val() + " 00:00:00" : false;
        		var to   = $('#end_date').val() ? $('#end_date').val() + " 23:59:59" : false;
        		self.graph_data(from, to, active_chart, category, limit);
        	}
	    },
	});
	gui.define_screen({name:'graph_view', widget: GraphScreenWidget});

	var GiftCardListScreenWidget = screens.ScreenWidget.extend({
        template: 'GiftCardListScreenWidget',

        init: function(parent, options){
            var self = this;
            this._super(parent, options);
            this.reload_btn = function(){
                $('.gift_reload').toggleClass('rotate', 'rotate-reset');
                self.reloading_gift_cards();
            };
            if(this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard){
                self.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
        },

        events: {
	    	'click .button.back':  'click_back',
	    	'keyup .searchbox input': 'search_order',
	    	'click .searchbox .search-clear': 'clear_search',
	        'click .button.create':  'click_create',
	        'click .button.reload': 'reload_btn',
	        'click #recharge_giftcard': 'click_recharge',
	        'click #edit_giftcard': 'click_edit_giftcard',
	        'click #exchange_giftcard': 'click_exchange',
	    },

        filter:"all",

        date: "all",
        click_back: function(){
        	this.gui.back();
        },
        click_create: function(event){
        	this.gui.show_popup('create_card_popup');
        },

        click_recharge: function(event){
        	var self = this;
        	var card_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_card_by_id(card_id);
            var order = self.pos.get_order();
            var client = order.get_client();
            self.gui.show_popup('recharge_card_popup',{
            	'card_id':result.id,
            	'card_no':result.card_no,
            	'card_value':result.card_value,
            	'customer_id':result.customer_id
            });
        },

        click_edit_giftcard: function(event){
        	var self  = this;
        	var card_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_card_by_id(card_id);
            if (result) {
                self.gui.show_popup('edit_card_popup',{'card_id':card_id,'card_no':result.card_no,'expire_date':result.expire_date});
            }
        },

        click_exchange: function(event){
        	var self = this;
        	var card_id = parseInt($(event.currentTarget).data('id'));
            var result = self.pos.db.get_card_by_id(card_id);
            if (result) {
                self.gui.show_popup('exchange_card_popup',{'card_id':card_id,'card_no':result.card_no});
            }
        },

        search_order: function(event){
        	var self = this;
        	var search_timeout = null;
        	clearTimeout(search_timeout);
            var query = $(event.currentTarget).val();
            search_timeout = setTimeout(function(){
                self.perform_search(query,event.which === 13);
            },70);
        },

        get_gift_cards: function(){
        	return this.pos.get('gift_card_order_list');
        },

        show: function(){
        	var self = this;
            this._super();
            this.reload_gift_cards();
            this.reloading_gift_cards();
            $('.issue_date_filter').datepicker({
           	    dateFormat: 'yy-mm-dd',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function (dateText, inst) {
                	var date = $(this).val();
					if (date){
					    self.date = date;
					    self.render_list(self.get_gift_cards());
					}
				},
				onClose: function(dateText, inst){
                    if( !dateText ){
                        self.date = "all";
                        self.render_list(self.get_gift_cards());
                    }
                }
           }).focus(function(){
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.date = "all";
                    self.render_list(self.get_gift_cards());
                });
           });
           $('.expiry_date_filter').datepicker({
           	    dateFormat: 'yy-mm-dd',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function (dateText, inst) {
                	var date = $(this).val();
					if (date){
					    self.expire_date = date;
					    self.render_list(self.get_gift_cards());
					}
				},
				onClose: function(dateText, inst){
                    if( !dateText ){
                        self.expire_date = "all";
                        self.render_list(self.get_gift_cards());
                    }
                }
           }).focus(function(){
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.expire_date = "all";
                    self.render_list(self.get_gift_cards());
                });
           });
        },

        perform_search: function(query, associate_result){
            var self = this;
            if(query){
                var gift_cards = self.pos.db.search_gift_card(query);
                if ( associate_result && gift_cards.length === 1){
                    this.gui.back();
                }
                this.render_list(gift_cards);
            }else{
                this.render_list(self.get_gift_cards());
            }
        },

        clear_search: function(){
            this.render_list(this.get_gift_cards());
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },

        render_list: function(gift_cards){
            var self = this;
            var contents = this.$el[0].querySelector('.giftcard-list-contents');
            contents.innerHTML = "";
            var temp = [];
            if(self.filter !== "" && self.filter !== "all"){
                gift_cards = $.grep(gift_cards,function(gift_card){
                    return gift_card.state === self.filter;
                });
            }
            if(self.date !== "" && self.date !== "all"){
                var x = [];
                for (var i=0; i<gift_cards.length;i++){
                    var date_expiry = gift_cards[i].expire_date;
                    var date_issue = gift_cards[i].issue_date;
                    if(self.date == date_issue){
                        x.push(gift_cards[i]);
                    }
                }
                gift_cards = x;
            }
            if(self.expire_date !== "" && self.expire_date !== "all"){
            	var y = [];
                for (var i=0; i<gift_cards.length;i++){
                    var date_expiry = gift_cards[i].expire_date;
                    var date_issue = gift_cards[i].issue_date;
                    if(self.expire_date == date_expiry){
                        y.push(gift_cards[i]);
                    }
                }
                gift_cards = y;
            }
            for(var i = 0, len = Math.min(gift_cards.length,1000); i < len; i++){
                var gift_card    = gift_cards[i];
                gift_card.amount = parseFloat(gift_card.amount).toFixed(2); 
                var clientline_html = QWeb.render('GiftCardlistLine',{widget: this, gift_card:gift_card});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
            $("table.giftcard-list").simplePagination({
                previousButtonClass: "btn btn-danger",
                nextButtonClass: "btn btn-danger",
                previousButtonText: '<i class="fa fa-angle-left fa-lg"></i>',
                nextButtonText: '<i class="fa fa-angle-right fa-lg"></i>',
                perPage: 10
            });
        },

        reload_gift_cards: function(){
            var self = this;
            this.render_list(self.get_gift_cards());
        },

        reloading_gift_cards: function(){
            var self = this;
            var params = {
            	model: 'aspl.gift.card',
            	method: 'search_read',
            	domain: [['is_active', '=', true]],
            }
            return rpc.query(params, {async: false}).then(function(result){
                self.pos.db.add_giftcard(result);
                self.pos.set({'gift_card_order_list' : result});
                self.date = 'all';
                self.expire_date = 'all';
                self.reload_gift_cards();
                return self.pos.get('gift_card_order_list');
            }).fail(function (error, event){
                if(error.code === 200 && error.data ){    // Business Logic Error, not a connection problem
                    self.gui.show_popup('error-traceback',{
                        message: error.data.message,
                        comment: error.data.debug
                    });
                }else {
					self.pos.db.notification('danger','Connection lost');
				}
                event.preventDefault();
                var gift_cards = self.pos.get('gift_card_order_list');
                console.error('Failed to send gift card:', gift_cards);
                self.reload_gift_cards();
                return gift_cards
            });
        },
    });
    gui.define_screen({name:'giftcardlistscreen', widget: GiftCardListScreenWidget});

    var GiftVoucherListScreenWidget = screens.ScreenWidget.extend({
        template: 'GiftVoucherListScreenWidget',

        init: function(parent, options){
            var self = this;
            this._super(parent, options);
            this.reload_btn = function(){
                $('.voucher_reload').toggleClass('rotate', 'rotate-reset');
                self.reloading_gift_vouchers();
            };
        },

        filter:"all",

        date: "all",

        start: function(){
            var self = this;
            this._super();
            var gift_vouchers = self.pos.get('gift_voucher_list');
            this.render_list(gift_vouchers);
            this.$('.back').click(function(){
                self.gui.back();
            });
            this.$('.button.create').click(function(){
                self.gui.show_popup('create_gift_voucher');
            });
            $('input#search_voucher_expiry_date').datepicker({
           		'dateFormat': 'yy-mm-dd',
               'autoclose': true,
               onSelect: function(dateText) {
                    if(dateText === ""){
	            		self.date = "all"
	            	}else {
	            		self.date = dateText;
	            	}
	            	self.render_list(gift_vouchers);
                },
            });

            //searchbox
            var search_timeout = null;
            if(this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard){
                self.chrome.widget.keyboard.connect(this.$('.searchbox.voucher_search input'));
            }
            this.$('.searchbox.voucher_search input').on('keyup',function(event){
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function(){
                    self.perform_search(query,event.which === 13);
                },70);
            });
            this.$('.searchbox.voucher_search .search-clear').click(function(){
                self.clear_search();
            });
        },

        show: function(){
            this._super();
            this.reload_gift_vouchers();
        },

        perform_search: function(query, associate_result){
        	var self = this;
            if(query){
                var gift_vouchers = self.pos.db.search_gift_vouchers(query);
                if ( associate_result && gift_vouchers.length === 1){
                    this.gui.back();
                }
                this.render_list(gift_vouchers);
            }else{
                var gift_vouchers = self.pos.get('gift_voucher_list');
                this.render_list(gift_vouchers);
            }
        },

        clear_search: function(){
            var gift_cards = this.pos.get('gift_voucher_list');
            this.render_list(gift_cards);
            this.$('.searchbox.voucher_search input')[0].value = '';
            this.$('.searchbox.voucher_search input').focus();
        },

        render_list: function(gift_vouchers){

    		var self = this;
            var contents = this.$el[0].querySelector('.giftvoucher-list-contents');
            contents.innerHTML = "";
            var temp = [];
            if(self.filter !== "" && self.filter !== "all"){
                gift_vouchers = $.grep(gift_vouchers,function(gift_voucher){
                    return gift_vouchers.state === self.filter;
                });
            }
            if(self.date !== "" && self.date !== "all"){
                var x = [];
                for (var i=0; i<gift_vouchers.length;i++){
                    var date_expiry = gift_vouchers[i].expiry_date;
                    if(self.date === date_expiry){
                        x.push(gift_vouchers[i]);
                    }
                }
                gift_vouchers = x;
            }
            for(var i = 0, len = Math.min(gift_vouchers.length,1000); i < len; i++){
                var gift_voucher    = gift_vouchers[i];
                gift_voucher.amount = parseFloat(gift_voucher.amount).toFixed(2);
                var clientline_html = QWeb.render('GiftVoucherlistLine',{widget: this, gift_voucher:gift_voucher});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
            $("table.giftvoucher-list").simplePagination({
                previousButtonClass: "btn btn-danger",
                nextButtonClass: "btn btn-danger",
                previousButtonText: '<i class="fa fa-angle-left fa-lg"></i>',
                nextButtonText: '<i class="fa fa-angle-right fa-lg"></i>',
                perPage: 10
            });
        },

        reload_gift_vouchers: function(){
            var self = this;
            var gift_vouchers = self.pos.get('gift_voucher_list');
            this.render_list(gift_vouchers);
        },

        reloading_gift_vouchers: function(){
            var self = this;
            var voucher_params = {
            	model: 'aspl.gift.voucher',
            	method: 'search_read',
            	args: [],
            }
            return rpc.query(voucher_params, {async: false}).then(function(result){
            	self.pos.db.add_gift_vouchers(result);
                self.pos.set({'gift_voucher_list' : result});
                self.date = 'all';
                self.reload_gift_vouchers();
                return self.pos.get('gift_voucher_list');
            }).fail(function (error, event){
                if(error.code === 200 && error.data ){    // Business Logic Error, not a connection problem
                    self.gui.show_popup('error-traceback',{
                        message: error.data.message,
                        comment: error.data.debug
                    });
                } else {
					self.pos.db.notification('danger','Connection lost');
				}
                event.preventDefault();
                var gift_vouchers = self.pos.get('gift_voucher_list');
                console.error('Failed to send orders:', gift_cards);
                self.reload_gift_vouchers();
                return gift_vouchers
            });
        },

        renderElement: function(){
            var self = this;
            self._super();
            self.el.querySelector('.button.reload').addEventListener('click',this.reload_btn);
        },
    });
    gui.define_screen({name:'voucherlistscreen', widget: GiftVoucherListScreenWidget});

//    Stock Picking Screen
    var DiscardProductScreenWidget = screens.ScreenWidget.extend({
        template: 'DiscardProductScreenWidget',

        init: function(parent, options){
            var self = this;
            this._super(parent, options);
            if(this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard){
                self.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
        },
        events: {
	    	'click .button.back':  'click_back',
	    	'keyup .searchbox input': 'search_order',
	    	'click .searchbox .search-clear': 'clear_search',
	    },
        filter:"all",
        date: "all",
        click_back: function(){
        	this.gui.back();
        },
        search_order: function(event){
        	var self = this;
        	var search_timeout = null;
        	clearTimeout(search_timeout);
            var query = $(event.currentTarget).val();
            search_timeout = setTimeout(function(){
                self.perform_search(query,event.which === 13);
            },70);
        },
        get_stock_picking: function(){
        	return this.pos.get('stock_picking_list');
        },
        show: function(){
        	var self = this;
            this._super();
            this.reloading_stock_picking();
            var search_timeout = null;
            this.$('.stockpicking-list-contents').delegate('.stock-line','click',function(event){
                self.line_select(event,$(this),parseInt($(this).data('id')));
                event.stopImmediatePropagation();
            });
            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress',function(event){
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function(){
                    self.perform_search(query,event.which === 13);
                },70);
            });
            this.$('.searchbox .search-clear').click(function(){
                self.clear_search();
            });
            $('.issue_date_filter').datepicker({
           	    dateFormat: 'yy-mm-dd',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function (dateText, inst) {
                	var date = $(this).val();
					if (date){
					    self.date = date;
					    self.render_list(self.get_stock_picking());
					}
				},
				onClose: function(dateText, inst){
                    if( !dateText ){
                        self.date = "all";
                        self.render_list(self.get_stock_picking());
                    }
                }
           }).focus(function(){
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.date = "all";
                    self.render_list(self.get_stock_picking());
                });
           });
        },
        perform_search: function(query, associate_result){
            var self = this;
            if(query){
                var search_stock = self.pos.db.search_stock_picking(query);
                if ( associate_result && search_stock.length === 1){
                    this.gui.back();
                }
                this.render_list(search_stock);
            }else{
                this.render_list(self.get_stock_picking());
            }
        },
        clear_search: function(){
            this.render_list(this.get_stock_picking());
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        render_list: function(stock_picking){
            var self = this;
            var contents = this.$el[0].querySelector('.stockpicking-list-contents');
            contents.innerHTML = "";
            var temp = [];
            if(self.date !== "" && self.date !== "all"){
                var x = [];
                for (var i=0; i<stock_picking.length;i++){
                    var date_issue = stock_picking[i].scheduled_date;
                    var new_date=date_issue.split(' ')[0];
                    if(self.date == new_date){
                        x.push(stock_picking[i]);
                    }
                }
                stock_picking = x;
            }
            for(var i = 0, len = Math.min(stock_picking.length,1000); i < len; i++){
                var stock    = stock_picking[i];
                var clientline_html = QWeb.render('StockPickinglistLine',{widget: this, stock_picking:stock});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
        },
        line_select: function(event,$line,id){
	        var picking_data = this.pos.db.get_picking_by_id(id);
            this.$('.stock-picking-list .lowlight').removeClass('lowlight');
            if ( $line.hasClass('highlight') ){
                $line.removeClass('highlight');
                $line.addClass('lowlight');
                this.display_product_details('hide',picking_data);
	        }else{
                this.$('.stock-picking-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                var y = event.pageY - $line.parent().offset().top;
	            this.display_product_details('show',picking_data,y);
	            this.new_stock = picking_data;
            }
	    },
        display_product_details: function(visibility,picking_data,clickpos){
            var self = this;
            var contents = this.$('.stock-picking-details-contents');
            var parent   = this.$('.client-list').parent();
            var scroll   = parent.scrollTop();
            var height   = contents.height();
            if(visibility === 'show'){
                contents.empty();
                this.$('.subwindow').addClass('add');
                var move_lines = picking_data.move_lines;
                var stock_move = {
                    model: 'stock.move',
                    method: 'search_read',
                    domain:[['id','=',move_lines]],
                }
                return rpc.query(stock_move, {async: false}).then(function(stock_move_data){
                    contents.append($(QWeb.render('StockPickingDetails',{widget:this,stock:stock_move_data})));
                    var new_height   = contents.height();
                    if(!this.details_visible){
                        // resize client list to take into account client details
                        parent.height('-=' + new_height);
                        if(clickpos < scroll + new_height + 20 ){
                            parent.scrollTop( clickpos - 20 );
                        }else{
                            parent.scrollTop(parent.scrollTop() + new_height);
                        }
                    }else{
                        parent.scrollTop(parent.scrollTop() - height + new_height);
                    }
                    this.details_visible = true;
                  });
            } else if (visibility === 'hide') {
                contents.empty();
                this.$('.subwindow').removeClass('add');
                parent.height('100%');
                if( height > scroll ){
                    contents.css({height:height+'px'});
                    contents.animate({height:0},400,function(){
                        contents.css({height:''});
                    });
                }else{
                    parent.scrollTop( parent.scrollTop() - height);
                }
                this.details_visible = false;
            }
        },
        reload_stock_picking: function(){
            var self = this;
            this.render_list(self.get_stock_picking());
        },
        reloading_stock_picking: function(){
            var self = this;
            var params = {
            	model: 'stock.picking',
            	method: 'search_read',
            	domain: [['state', '=', 'done'],['origin','=',false]],
            }
            return rpc.query(params, {async: false}).then(function(result){
                self.pos.db.add_stock_picking(result);
                self.pos.set({'stock_picking_list' : result});
                self.date = 'all';
                self.expire_date = 'all';
                self.reload_stock_picking();
                return self.pos.get('stock_picking_list');
            }).fail(function (error, event){
                if(error.code === 200 ){    // Business Logic Error, not a connection problem
                    self.gui.show_popup('error-traceback',{
                        message: error.data.message,
                        comment: error.data.debug
                    });
                }
                event.preventDefault();
                var stock_pic = self.pos.get('stock_picking_list');
                console.error('Failed to stock picking:', stock_pic);
                self.reload_stock_picking();
                return stock_pic
            });
        },
    });
    gui.define_screen({name:'stockpickinglistscreen', widget: DiscardProductScreenWidget});

    var OpeningBalanceScreenWidget = screens.ScreenWidget.extend({
        template: 'OpeningBalanceScreenWidget',
        init: function(parent, options){
            var self = this;
            this._super(parent, options);
        },
        show: function() {
        	this._super();
        	var self = this;
        	this.renderElement();
        	$('#skip').click(function(){
                self.gui.show_screen('products');
                var params = {
                                model: 'pos.session',
                                method: 'close_open_balance',
                                args:[self.pos.pos_session.id]
                              }
                rpc.query(params, {async: false})
        	});
        	$(document).keypress(function (e) {
                if (e.which != 8 && e.which != 46 && e.which != 0 && (e.which < 48 || e.which > 57)) {
                    return false;
                }
            });
        },
        renderElement:function(){
            this._super();
            var self = this;
        	self.open_form();
        },
        open_form: function() {
        	var self = this;
            var open_table_row = "<tr id='open_balance_row'>" +
                            "<td><input type='text'  class='openbalance_td' id='value' value='0.00' /></td>" +
                            "<td><input type='text' class='openbalance_td' id='no_of_values' value='0.00' /></td>" +
                            "<td><input type='text' class='openbalance_td' id='subtotal' disabled='true' value='0.00' /></td>" +
                            "<td id='delete_row'><span class='fa fa-trash-o' style='font-size: 20px;'></span></td>" +
                            "</tr>";
            $('#opening_cash_table tbody').append(open_table_row);
            $('#add_open_balance').click(function(){
                $('#opening_cash_table tbody').append(open_table_row);
            });
            $('#opening_cash_table tbody').on('click', 'tr#open_balance_row td#delete_row',function(){
                $(this).parent().remove();
                self.compute_subtotal();
			});
            $('#opening_cash_table tbody').on('change focusout', 'tr#open_balance_row td',function(){
                var no_of_value, value;
                if($(this).children().attr('id') === "value"){
                    value = Number($(this).find('#value').val());
                    no_of_value = Number($(this).parent().find('td #no_of_values').val());
                }else if($(this).children().attr('id') === "no_of_values"){
                    no_of_value = Number($(this).find('#no_of_values').val());
                    value = Number($(this).parent().find('td #value').val());
                }
                $(this).parent().find('td #subtotal').val(value * no_of_value);
                self.compute_subtotal();
            });
            this.compute_subtotal = function(event){
                var subtotal = 0;
                _.each($('#open_balance_row td #subtotal'), function(input){
                    if(Number(input.value) && Number(input.value) > 0){
                        subtotal += Number(input.value);
                    }
                });
                $('.open_subtotal').text(subtotal);
            }
            $('#validate_open_balance').click(function(){
                var items = []
                var open_balance = []
                var total_open_balance = 0.00;
                $(".openbalance_td").each(function(){
                    items.push($(this).val());
                });
                while (items.length > 0) {
                  open_balance.push(items.splice(0,3))
                }
                _.each(open_balance, function(balance){
                    total_open_balance += Number(balance[2])
                });
                if(total_open_balance > 0){
                    var params = {
                                    model: 'pos.session',
                                    method: 'open_balance',
                                    args:[self.pos.pos_session.id,total_open_balance]
                                 }
                    rpc.query(params, {async: false}).then(function(res){
                            if(res){
                                self.gui.show_screen('products');
                            }
                    }).fail(function (type, error){
                        if(error.code === 200 ){    // Business Logic Error, not a connection problem
                           self.gui.show_popup('error-traceback',{
                                'title': error.data.message,
                                'body':  error.data.debug
                           });
                        }
                    });
                } else{
                    return;
                }
            });
        },
    });
    gui.define_screen({name:'openingbalancescreen', widget: OpeningBalanceScreenWidget});

    var ProductExpiryDeshboardWidget = screens.ScreenWidget.extend({
	    template: 'ProductExpiryDeshboardWidget',
	    init: function(parent, options){
	    	this._super(parent, options);
	    	var self = this;
	    	this.bar_chart = function(){
	        	var order = self.pos.get_order();
	        	var data = order.get_result_expire_graph();
	        	var dps = [];
        		if(data){
	        		for(var i=0;i<data.length;i++){
		        		dps.push({label: data[i].product_name, y: data[i].qty});
		        	}
	        	}
        		var symbol = 'Qty-#######.00';
	    		var chart = new CanvasJS.Chart("chartContainer_expiry_dashboard",{
	    			width: data && data.length > 10 ? 1200 : 0,
	    			dataPointMaxWidth:25,
	    			zoomEnabled:true,
	    			theme: "theme3",
	    			title: {
	    				text: $('a.menu_selected').text()
	    			},
	    			axisY: {
	    				suffix: ""
	    			},		
	    			legend :{
	    				verticalAlign: 'bottom',
	    				horizontalAlign: "center"
	    			},
	    			data: [{
	    				type: "column",
	    				bevelEnabled: true,
	    				indexLabel:'{y}',
	    				indexLabelOrientation: "vertical", //horizontal
	    				yValueFormatString:symbol || '',
	    				dataPoints: dps
	    			}]
	    		});
	    		chart.render();
	        };
	        this.pie_chart = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_result_expire_graph();
	        	var dps = [];
	        	for(var i=0;i<data.length;i++){
	        		dps.push({label: data[i].product_name, y: data[i].qty});
	        	}
	        	var chart = new CanvasJS.Chart("chartContainer_expiry_dashboard",
    			{
	    			zoomEnabled:true,
    				theme: "theme2",
    				title:{
    					text: $('a.menu_selected').text()
    				},
    				data: [{
    					type: "pie",
    					showInLegend: true,
    					toolTipContent: "{y} - #percent %",
    					yValueFormatString: "",
    					legendText: "{indexLabel}",
    					dataPoints: dps
    				}]
    			});
    			chart.render();
	        };
	    },
	    start: function(){
	    	var self = this;
	    	self._super();
	    	$("#explorer_text").text("More");
            this.$('#explorable_div').click(function(){
            	if($(this).hasClass('hidden')){
            		$(this).removeClass('hidden');
                	$(this).addClass('explore');
                	$('.expired-by-product-list').addClass('explore')
                	$('.expired-by-product-container').addClass('explore')
                	$("#explorer_text").text("Less");
            	} else{
            		$(this).removeClass('explore');
            		$(this).addClass('hidden');
            		$('.expired-by-product-list').removeClass('explore')
                	$('.expired-by-product-container').removeClass('explore')
                	$("#explorer_text").text("More");
            	}
            });
	    	/*Bar Chart*/
            this.$('#bar_chart_expire_dashboard').click(function(){
            	var order = self.pos.get_order();
            	if($('#bar_chart_expire_dashboard').hasClass('selected_chart')){
            	}else{
            		$('#bar_chart_expire_dashboard').addClass('selected_chart');
        			if(self.$('#pie_chart_expire_dashboard').hasClass('selected_chart')){
            			self.$('#pie_chart_expire_dashboard').removeClass('selected_chart');
            		}
        			self.get_graph_information();
                	self.bar_chart();
            	}
            });
            /*Pie Chart*/
            this.$('#pie_chart_expire_dashboard').click(function(){
            	if($('#pie_chart_expire_dashboard').hasClass('selected_chart')){
            	}else{
            		$('#pie_chart_expire_dashboard').addClass('selected_chart');
        			if(self.$('#bar_chart_expire_dashboard').hasClass('selected_chart')){
            			self.$('#bar_chart_expire_dashboard').removeClass('selected_chart');
            		}
        			self.get_graph_information();
        			self.pie_chart();
            	}
            });
            this.$('.location-list-contents').delegate('.location-line','click',function(event){
        		var location_id = parseInt($(this).data('id'));
        		var records = self.get_products_qty_based__location(location_id)
        		self.pos.product_detail_record = records;
        		var title = "Location : " + records[0].location_id[1];
        		self.pos.set_title_detail_expire_screen(title)
        		self.gui.show_screen('product_detail_list');
            });
        	this.$('.warehouse-list-contents').delegate('.warehouse-line','click',function(event){
            	var location_id = parseInt($(this).data('id'));
            	var warehouse_name = self.pos.warehouse_name_by_loc_id[location_id]
            	if(warehouse_name){
            		var warehouse_title = "Warehouse : " + warehouse_name
            		self.pos.set_title_detail_expire_screen(warehouse_title)
            	}
            	var records = self.get_products_qty_based__location(location_id)
            	self.pos.product_detail_record = records;
            	self.gui.show_screen('product_detail_list');
            });
        	this.$('.categories-view-container').delegate('.expired-product-count-category','click',function(event){
        		var category_id = parseInt($(this).data('id'));
        		self.pos.set_title_detail_expire_screen(false)
        		var params = {
                    model: 'product.product',
                    method: 'category_expiry',
                    args:[self.pos.company.id,category_id],
                 }
                rpc.query(params, {async: false})
                .then(function(records){
                	self.pos.product_detail_record = records;
                	self.gui.show_screen('product_detail_list');
                });
        	});
	    },
	    get_graph_information: function(){
	    	var self = this;
    		var active_chart = $('span.selected_chart').attr('id');
    		var from = $('#start_date_expire_deshboard').val() ? $('#start_date_expire_deshboard').val() + " 00:00:00" : false;
    		var to   = $('#end_date_expire_deshboard').val() ? $('#end_date_expire_deshboard').val() + " 23:59:59" : false;
    		self.graph_data(from, to, active_chart);
	    },
	    graph_data: function(from, to, active_chart){
	    	var self = this;
            rpc.query({
                model: 'product.product',
                method: 'graph_date_on_canvas',
                args: [from, to]
            },{async:false}).then(
                function(result) {
					var order = self.pos.get_order();
					if(result){
						if(result.length > 0){
							order.set_result_expire_graph(result);
						}else{
							order.set_result_expire_graph(0);
						}
					}else{
						order.set_result_expire_graph(0);
					}
					if(active_chart == "bar_chart"){
	            		self.bar_chart();
	            	}
					if(active_chart == "pie_chart"){
	            		self.pie_chart();
	            	}
				}).fail(function(error, event) {
				if (error.code === -32098) {
					alert("Server closed...");
					event.preventDefault();
				}
			});
	    },
	    filter:"all",
        date: "all",
	    show: function(){
        	var self = this;
        	this._super();
        	$('#login_user_expire_screen').text(self.pos.get_cashier().name)
        	var params = {
                model: 'product.product',
                method: 'search_product_expiry',
             }
            rpc.query(params, {async: false})
            .then(function(records){
            	self.pos.report_records = records;
            	self.pos.warehouse_name_by_loc_id = {};
            	if (records.warehouse_wise_expire && records.warehouse_wise_expire[0]){
            		_.each(records.warehouse_wise_expire, function(warehouse){
            			self.pos.warehouse_name_by_loc_id[warehouse.location_id] = warehouse.warehouse_name;
            		})
            	}
            	self.pos.db.add_expire_categ(records['category_near_expire'])
            	$('#60days').text(records['60']);
            	$('#30days').text(records['30']);
            	$('#15days').text(records['15']);
            	$('#10days').text(records['10']);
            	$('#5days').text(records['5']);
            	$('#1day').text(records['1']);
            	$('#near_expired').text(records['near_expired']);
            });
        	$('#near_expired').click(function(){
        		var params = {
                    model: 'stock.quant',
                    method: 'search_read',
                    domain:[['state_check','=','near_expired'],['company_id.id','=', self.pos.company.id]],
                 }
                rpc.query(params, {async: false})
                .then(function(records){
                	self.pos.product_detail_record = records;
                	self.gui.show_screen('product_detail_list');
                });
            });
        	self.graph_data(false, false, 'bar_chart');
            this.$('.back').click(function(){
                self.gui.show_screen('products');
            });
            var start_date = false;
	    	var end_date = false;
	    	var active_chart = $('span.selected_chart').attr('id');
            $("#start_date_expire_deshboard").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				start_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    	    		self.graph_data(start_date, end_date, active_chart);
    			},
    		});
    		$("#end_date_expire_deshboard").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				end_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    	    		self.graph_data(start_date, end_date, active_chart);
    		    },
    		});
        	$("#start_date_expire_deshboard").val('');
        	$("#end_date_expire_deshboard").val('');
        	var search_timeout = null;
        	if(self.pos.report_records && self.pos.report_records['category_near_expire'] && self.pos.report_records['category_near_expire'][0]){
        		self.render_list_category(self.pos.report_records['category_near_expire']);
        	}
        	this.$('#search_category').on('keypress',function(event){
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function(){
                    self.perform_search(query,event.which === 13);
                },70);
            });
        	if(self.pos.report_records && self.pos.report_records['location_wise_expire'] && self.pos.report_records['location_wise_expire'][0]){
        		self.render_location_list(self.pos.report_records['location_wise_expire'])
        	}
        	if(self.pos.report_records && self.pos.report_records['warehouse_wise_expire'] && self.pos.report_records['warehouse_wise_expire'][0]){
        		self.render_warehouse_list(self.pos.report_records['warehouse_wise_expire'])
        	}
        	$('.expired-product-count').click(function(){
        		var day_exp =  parseInt($(this).data('id'));
        		self.pos.set_title_detail_expire_screen(false)
        		var params = {
                    model: 'product.product',
                    method: 'get_expire_data_near_by_day',
                    args:[self.pos.company.id,day_exp],
                 }
                rpc.query(params, {async: false})
                .then(function(records){
                	self.pos.product_detail_record = records;
                	self.gui.show_screen('product_detail_list');
                });
        	})
	    },
	    get_products_qty_based__location: function(location_id){
	    	var params = {
                model: 'stock.quant',
                method: 'search_read',
                domain:[['state_check','=','near_expired'],['location_id','=',location_id]],
             }
	    	var location_line_detail; 
            rpc.query(params, {async: false})
            .then(function(records){
            	location_line_detail = records
            });
	    	return location_line_detail;
	    },
	    render_location_list: function(location_data){
	        var contents = this.$el[0].querySelector('.location-list-contents');
	        contents.innerHTML = "";
	        for(var i = 0, len = Math.min(location_data.length,1000); i < len; i++){
	            var location    = location_data[i];
                var location_html = QWeb.render('LocationLine',{widget: this, location:location_data[i]});
                var locationline = document.createElement('tbody');
                locationline.innerHTML = location_html;
                locationline = locationline.childNodes[1];
	            contents.appendChild(locationline);
	        }
	    },
	    render_warehouse_list: function(warehouse_data){
	        var contents = this.$el[0].querySelector('.warehouse-list-contents');
	        contents.innerHTML = "";
	        for(var i = 0, len = Math.min(warehouse_data.length,1000); i < len; i++){
	            var warehouse = warehouse_data[i];
                var warehouse_html = QWeb.render('WarehouseLine',{widget: this, warehouse:warehouse_data[i]});
                var warehouseline = document.createElement('tbody');
                warehouseline.innerHTML = warehouse_html;
                warehouseline = warehouseline.childNodes[1];
	            contents.appendChild(warehouseline);
	        }
	    },
	    perform_search: function(query, associate_result){
            var self = this;
            if(query){
                var exprire_categories = self.pos.db.search_exprire_categories(query);
                this.render_list_category(exprire_categories);
            }else{
                var exprire_categories = self.pos.report_records['category_near_expire'];
                this.render_list_category(exprire_categories);
            }
        },
        render_list_category: function(category){
	        var contents = this.$el[0].querySelector('.categories-view-container');
	        contents.innerHTML = "";
	        for(var i=0;i<category.length;i++){
	            var report_list = category[i];
                var reportsline_html = QWeb.render('ExpireByCategory',{widget: this, category:category[i]});
                var report_tbody = document.createElement('tbody');
                report_tbody.innerHTML = reportsline_html;
                report_tbody = report_tbody.childNodes[1];
	            contents.appendChild(report_tbody);
	        }
	    },
    });
    gui.define_screen({name:'product_expiry_deshboard', widget: ProductExpiryDeshboardWidget});

    var ProductDetailListScreen = screens.ScreenWidget.extend({
	    template: 'ProductDetailListScreen',
	    init: function(parent, options){
	        var self = this;
	        self._super(parent, options);
	    },
	    show: function(){
            var self = this;
            self.screen_title = self.pos.get_title_detail_expire_screen();
            if(self.screen_title){
            	$('#screen_title').html(self.screen_title)
            } else{
            	$('#screen_title').html("")
            }
            self._super();
            self.product_detail_record = self.pos.product_detail_record;
            if(self.product_detail_record){
            	self.pos.db.add_detail_product_list(self.product_detail_record);
            	self.render_product_detail(self.product_detail_record);
            }
            var search_timeout = null;
            this.$('#search_product_detail_exp').on('keypress',function(event){
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function(){
                    self.perform_search(query,event.which === 13);
                },70);
            });
            this.$('.back').click(function(){
                self.gui.show_screen('product_expiry_deshboard');
            });
	    },
	    render_product_detail: function(product_list){
	    	var self = this;
	        var contents = this.$el[0].querySelector('.product-detail-list-contents');
	        contents.innerHTML = "";
	        _.each(product_list, function(product){
                var reportsline_html = QWeb.render('ProductDetailLine',{widget: self, product:product});
                var report_tbody = document.createElement('tbody');
                report_tbody.innerHTML = reportsline_html;
                report_tbody = report_tbody.childNodes[1];
	            contents.appendChild(report_tbody);
	        });
	    },
	    perform_search: function(query, associate_result){
            var self = this;
            if(query){
                var product_details = self.pos.db.search_detail_product_list(query);
                this.render_product_detail(product_details);
            }else{
                this.render_product_detail(self.product_detail_record);
            }
        },
    });
    gui.define_screen({name:'product_detail_list', widget: ProductDetailListScreen});

    var POSDashboardGraphScreenWidget = screens.ScreenWidget.extend({
	    template: 'POSDashboardGraphScreenWidget',
	    init: function(parent, options){
	    	this._super(parent, options);
	    	var self = this;
	        this.pie_chart_journal = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_graph_data_journal();
	        	var dps = [];
	        	for(var i=0;i<data.length;i++){
	        		dps.push({label: data[i].name, y: data[i].sum});
	        	}
	        	var chart = new CanvasJS.Chart("chartContainer_journal",
    			{
	    			zoomEnabled:true,
    				theme: "theme2",
    				data: [{
    					type: "pie",
    					showInLegend: true,
    					toolTipContent: "{y} - #percent %",
    					yValueFormatString: "",
    					legendText: "{indexLabel}",
    					dataPoints: dps
    				}]
    			});
    			chart.render();
	        };
	        this.pie_chart_top_product = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_top_product_result();
	        	var dps = [];
	        	if(data && data[0]){
		        	for(var i=0;i<data.length;i++){
		        		dps.push({label: data[i].name, y: data[i].sum});
		        	}
	        	}
	        	var chart = new CanvasJS.Chart("chartContainer_top_product",
    			{
	    			zoomEnabled:true,
    				theme: "theme2",
    				data: [{
    					type: "pie",
    					showInLegend: true,
    					toolTipContent: "{y} - #percent %",
    					yValueFormatString: "",
    					legendText: "{indexLabel}",
    					dataPoints: dps
    				}]
    			});
    			chart.render();
	        };
	        this.pie_chart_customer = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_customer_summary();
	        	var dps = [];
	        	if(data){
	        		dps.push({label: "New Customer", y: data.new_client_sale});
	        		dps.push({label: "Existing Customer", y: data.existing_client_sale});
	        		dps.push({label: "Without Customer", y: data.without_client_sale});
	        	}
        		var chart = new CanvasJS.Chart("chartContainer_based_customer",
    			{
	    			zoomEnabled:true,
    				theme: "theme2",
    				data: [{
    					type: "pie",
    					showInLegend: true,
    					toolTipContent: "{y} - #percent %",
    					yValueFormatString: "",
    					legendText: "{indexLabel}",
    					dataPoints: dps
    				}]
    			});
    			chart.render();
	        };
	        this.bar_chart_hourly = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_hourly_summary();
	        	var dps = [];
	        	var dps2 = [];
	        	if(data && data[0]){
		        	for(var i=0;i<data.length;i++){
		        		dps.push({label: "("+data[i].date_order_hour[0] + "-" + data[i].date_order_hour[1	]+")", y: data[i].price_total});
		        		dps2.push({y: data[i].price_total});
		        	}
	        	}
        		var symbol = 'Amount-#######.00';
	    		var chart = new CanvasJS.Chart("chartContainer_hourly_sale",{
	    			width: data && data.length > 10 ? 1200 : 0,
	    			dataPointMaxWidth:25,
	    			zoomEnabled:true,
	    			animationEnabled: true,
	    			theme: "theme3",
	    			title: {
	    				text: "Today Hourly Sales"
	    			},
	    			axisY: {
	    				suffix: "",
	    				title:"Amount",
	    			},
	    			 axisX:{
	    				  title:"Hours",
	    				  labelAngle: 45,
	    				  interval:1
    				},
	    			legend :{
	    				verticalAlign: 'bottom',
	    				horizontalAlign: "center"
	    			},
	    			data: [{
	    				type: "column",
	    				dataPoints: dps,
	    				color:"#008080",
	    			},{
	    				type: "column",
	    				dataPoints: dps2,
	    				color:"#008080",
	    			}]
	    		});
	    		chart.render();
	        };
	        this.bar_chart_monthly = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_month_summary();
	        	var dps = [];
	        	if(data && data[0]){
		        	for(var i=0;i<data.length;i++){
		        		dps.push({label: data[i].date_order_day +'/'+data[i].date_order_month, y: data[i].price_total});
		        	}
	        		var symbol = 'Amount-#######.00';
		    		var chart = new CanvasJS.Chart("chartContainer_monthly_sale",{
		    			width: data && data.length > 10 ? 1200 : 0,
		    			dataPointMaxWidth:25,
		    			zoomEnabled:true,
		    			animationEnabled: true,
		    			theme: "theme3",
		    			title: {
		    				text: "This Month Sales"
		    			},axisY: {
		    				suffix: "",
		    				title:"Amount",
		    			},axisX:{
		    				  title:"Days",
		    				  interval:1
	    				},legend :{
		    				verticalAlign: 'bottom',
		    				horizontalAlign: "center"
		    			},data: [{
		    				type: "column",
		    				indexLabel:'{y}',
		    				xValueType: "dateTime",
		    				indexLabelOrientation: "vertical",
		    				dataPoints: dps
		    			}]
		    		});
		    		chart.render();
	        	}
	        };
	        this.bar_chart_six_month = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_six_month_summary();
	        	var dps = [];
	        	if(data && data[0]){
		        	for(var i=0;i<data.length;i++){
		        		dps.push({x: data[i].date_order_month, y: data[i].price_total});
		        	}
	        		var symbol = 'Amount-#######.00';
		    		var chart = new CanvasJS.Chart("chartContainer_six_month_sale",{
		    			width: data && data.length > 10 ? 1200 : 0,
		    			dataPointMaxWidth:25,
		    			zoomEnabled:true,
		    			animationEnabled: true,
		    			theme: "theme3",
		    			title: {
		    				text: "Last 12 Month Sales"
		    			},axisY: {
		    				suffix: "",
		    				title:"Amount",
		    			},axisX:{
		    				  title:"Months",
		    				  interval:1
	    				},legend :{
		    				verticalAlign: 'bottom',
		    				horizontalAlign: "center"
		    			},data: [{
		    				type: "column",
		    				indexLabel:'{y}',
		    				indexLabelOrientation: "vertical",
		    				dataPoints: dps
		    			}]
		    		});
		    		chart.render();
	        	}
	        };
	        this.bar_chart_active_session_wise_sale = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_active_session_sales();
	        	var dps = [];
	        	if(data && data[0]){
	        		_.each(data,function(session){
		        		dps.push({label: session.pos_session_id[0].display_name, y: session.sum});
		        	})
	        	}
	    		var chart = new CanvasJS.Chart("chartContainer_session_wise_sale",{
	    			width: data && data.length > 10 ? 1200 : 0,
	    			dataPointMaxWidth:25,
	    			zoomEnabled:true,
	    			animationEnabled: true,
	    			theme: "theme3",
	    			title: {
	    				text: "Today's Active Session(s) Sale"
	    			},axisY: {
	    				suffix: "",
	    				title:"Amount",
	    			},axisX:{
	    				title:"Sessions",
	    				interval:3
    				},legend :{
	    				verticalAlign: 'bottom',
	    				horizontalAlign: "center"
	    			},data: [{
	    				type: "column",
	    				indexLabel:'{y}',
	    				indexLabelOrientation: "vertical",
	    				dataPoints: dps
	    			}]
	    		});
	    		chart.render();
	        };
	        this.bar_chart_closed_session_wise_sale = function(){
	        	var order = this.pos.get_order();
	        	var data = order.get_closed_session_sales();
	        	var dps = [];
	        	if(data && data[0]){
		        	_.each(data,function(session){
		        		dps.push({label: session.pos_session_id[0].display_name, y: session.sum});
		        	})
	        	}
	    		var chart = new CanvasJS.Chart("chartContainer_closed_session_wise_sale",{
	    			width: data && data.length > 10 ? 1200 : 0,
	    			dataPointMaxWidth:25,
	    			zoomEnabled:true,
	    			animationEnabled: true,
	    			theme: "theme3",
	    			title: {
	    				text: "Today's Closed Session(s) Sale"
	    			},axisY: {
	    				suffix: "",
	    				title:"Amount",
	    			},axisX:{
	    				title:"Sessions",
	    				interval:3
					},legend :{
	    				verticalAlign: 'bottom',
	    				horizontalAlign: "center"
	    			},data: [{
	    				type: "column",
	    				indexLabel:'{y}',
	    				indexLabelOrientation: "vertical",
	    				dataPoints: dps
	    			}]
	    		});
	    		chart.render();
	        };
	    },
	    get_graph_information: function(){
    		var from = $('#start_date_journal').val() ? $('#start_date_journal').val() + " 00:00:00" : false;
    		var to   = $('#end_date_journal').val() ? $('#end_date_journal').val() + " 23:59:59" : false;
    		this.graph_data_journal(from,to);
	    },
	    get_top_product_graph_information: function(){
    		var from = $('#start_date_top_product').val() ? $('#start_date_top_product').val() + " 00:00:00" : false;
    		var to   = $('#end_date_top_product').val() ? $('#end_date_top_product').val() + " 23:59:59" : false;
    		this.graph_data_top_product(from,to);
	    },
	    get_sales_by_user_information: function(){
    		var from = $('#start_date_sales_by_user').val() ? $('#start_date_sales_by_user').val() + " 00:00:00" : false;
    		var to   = $('#end_date_sales_by_user').val() ? $('#end_date_sales_by_user').val() + " 23:59:59" : false;
	    	this.sales_by_user(from,to)
	    },
	    render_journal_list: function(journal_data){
	        var contents = this.$el[0].querySelector('.journal-list-contents');
	        contents.innerHTML = "";
	        for(var i = 0, len = Math.min(journal_data.length,1000); i < len; i++){
	            var journal = journal_data[i];
                var journal_html = QWeb.render('JornalLine',{widget: this, journal:journal_data[i]});
                var journalline = document.createElement('tbody');
                journalline.innerHTML = journal_html;
                journalline = journalline.childNodes[1];
	            contents.appendChild(journalline);
	        }
	    },
	    render_top_product_list: function(top_product_list){
	    	var contents = this.$el[0].querySelector('.top-product-list-contents');
	        contents.innerHTML = "";
	        for(var i = 0, len = Math.min(top_product_list.length,1000); i < len; i++){
	            var top_product = top_product_list[i];
                var top_product_html = QWeb.render('TopProductLine',{widget: this, top_product:top_product_list[i]});
                var top_product_line = document.createElement('tbody');
                top_product_line.innerHTML = top_product_html;
                top_product_line = top_product_line.childNodes[1];
	            contents.appendChild(top_product_line);
	        }
	    },
	    graph_data_journal: function(from, to){
	    	var self = this;
	    	rpc.query({	    			
                model: 'pos.order',
                method: 'graph_date_on_canvas',
                args: [from, to]
            },{async:false}).then(
                function(result) {
					var order = self.pos.get_order();
					if(result){
						self.render_journal_list(result)
						if(result.length > 0){
							order.set_graph_data_journal(result);
						}else{
							order.set_graph_data_journal(0);
						}
					}else{
						order.set_graph_data_journal(0);
					}
					self.pie_chart_journal();
				}).fail(function(error, event) {
				if (error.code === -32098) {
					alert("Server closed...");
					event.preventDefault();
				}
			});
	    },
	    graph_data_top_product: function(from, to){
	    	var self = this;
	    	rpc.query({	    			
                model: 'pos.order',
                method: 'graph_best_product',
                args: [from, to]
            },{async:false}).then(
                function(result) {
					var order = self.pos.get_order();
					if(result){
						self.render_top_product_list(result)
						if(result.length > 0){
							order.set_top_product_result(result);
						}else{
							order.set_top_product_result(0);
						}
					}else{
						order.set_top_product_result(0);
					}
					self.pie_chart_top_product();
				}).fail(function(error, event) {
				if (error.code === -32098) {
					alert("Server closed...");
					event.preventDefault();
				}
			});
	    },
	    sales_by_user: function(from, to){
	    	var self = this;
	    	rpc.query({
                model: 'pos.order',
                method: 'orders_by_salesperson',
                args: [from,to]
            },{async:false}).then(function(result) {
            	if(result){
            		self.render_user_wise_sales(result)
            	}
            });
	    },
	    sales_from_session: function(){
	    	var self = this;
	    	rpc.query({
                model: 'pos.order',
                method: 'session_details_on_canvas',
            },{async:false}).then(function(result) {
            	if(result){
            		if(result){
            			if(result.active_session && result.active_session[0]){
            				self.pos.get_order().set_active_session_sales(result.active_session);
            			}
            			if(result.close_session && result.close_session[0]){
            				self.pos.get_order().set_closed_session_sales(result.close_session)
            			}
            		}
            	}
            });
	    },
	    render_user_wise_sales: function(sales_users){
	    	var contents = this.$el[0].querySelector('.user-wise-sales-list-contents');
	        contents.innerHTML = "";
	        for(var i = 0, len = Math.min(sales_users.length,1000); i < len; i++){
	            var user_data = sales_users[i];
                var user_sales_html = QWeb.render('UserSalesLine',{widget: this, user_sales:sales_users[i]});
                var user_sales_line = document.createElement('tbody');
                user_sales_line.innerHTML = user_sales_html;
                user_sales_line = user_sales_line.childNodes[1];
	            contents.appendChild(user_sales_line);
	        }
	    },
	    show: function(){
        	var self = this;
        	this._super();
        	this.$('.back').click(function(){
                self.gui.show_screen('products');
            });
        	var today = moment().locale("en").format("YYYY-MM-DD")
        	$("#start_date_journal").val(today);
        	$("#end_date_journal").val(today);
        	$("#start_date_top_product").val(today);
        	$("#end_date_top_product").val(today);
        	$("#start_date_sales_by_user").val(today);
        	$("#end_date_sales_by_user").val(today);
            var start_date = false;
	    	var end_date = false;
	    	var active_chart = $('span.selected_chart').attr('id');
            $("#start_date_journal").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				start_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    	    		self.graph_data_journal(start_date, end_date);
    			},
    		});
    		$("#end_date_journal").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				end_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    				self.graph_data_journal(start_date, end_date);
    		    },
    		});
    		$("#start_date_top_product").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				start_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    	    		self.graph_data_top_product(start_date, end_date);
    			},
    		});
    		$("#end_date_top_product").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				end_date = dateText;
    				var active_chart = $('span.selected_chart').attr('id');
    				self.graph_data_top_product(start_date, end_date);
    		    },
    		});
    		$("#start_date_sales_by_user").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				start_date = dateText;
    				self.sales_by_user(start_date,end_date)
    			},
    		});
    		$("#end_date_sales_by_user").datepicker({
    			dateFormat: 'yy-mm-dd',
    			autoclose: true,
                closeText: 'Close',
                showButtonPanel: true,
    			onSelect: function(dateText, inst) {
    				end_date = dateText;
    				self.sales_by_user(start_date,end_date)
    		    },
    		});
        	rpc.query({
                model: 'pos.order',
                method: 'get_dashboard_data',
                args: []
            },{async:false}).then(function(result) {
            	self.pos.dashboard_data = result;
            	if(result){
            		$('#total_active_session').text(result['active_sessions'])
            		$('#total_closed_session').text(result['closed_sessions'])
                	$('#total_sale_count').text(result['total_orders']);
                	$('#total_sale_amount').text(self.chrome.format_currency(result['total_sales']));
                	var order = self.pos.get_order();
                	order.set_hourly_summary(result['sales_based_on_hours']);
                	order.set_month_summary(result['current_month']);
                	order.set_six_month_summary(result['last_6_month_res']);
                	order.set_customer_summary(result['client_based_sale']);
                	self.get_graph_information();
                	self.get_top_product_graph_information();
                	self.get_sales_by_user_information();
        			self.pie_chart_journal();
        			self.pie_chart_top_product();
        			self.bar_chart_hourly();
        			self.bar_chart_monthly();
        			self.bar_chart_six_month();
        			self.pie_chart_customer();
        			self.sales_from_session();
//        			self.bar_chart_active_session_wise_sale();
//        			self.bar_chart_closed_session_wise_sale();
            	}	
            });
	    },
    });
    gui.define_screen({name:'pos_dashboard_graph_view', widget: POSDashboardGraphScreenWidget});

    var OutStockProductsScreenWidget = screens.ScreenWidget.extend({
        template: 'OutStockProductsScreenWidget',
        init: function(parent, options){
            var self = this;
            this._super(parent, options);
            this.category = 0;
            self.product_click = function(){
            	var prodict_id = $(this).data('product-id');
            	if(prodict_id){
            		var product = self.pos.db.get_product_by_id(prodict_id);
            		if(product){
            		    if($(this).hasClass('highlight')){
            		        $(this).removeClass('highlight');
            		        var removeItem = product;
            		        self.selected_product = jQuery.grep(self.selected_product, function(value) {
                              return value != removeItem;
                            });
            		    } else{
            		        $(this).addClass('highlight');
            		        self.selected_product.push(product)
                        }
//            			self.gui.show_popup('show_product_popup',{'product':product});
            		}
            	}
            };
            self.clear_search_handler = function(event){
                self.clear_search();
                var input = $('.searchbox input');
            	input.val('');
                input.focus();
            };
            var search_timeout  = null;
            self.namelist = [];
    		_.each(self.pos.db.get_product_namelist(),function(list){
                self.namelist.push(list[1]);
    		});
            this.search_handler = function(event){
            	$(this).autocomplete({
                    source:self.namelist,
            	});
            	var searchbox = this;
                if(event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8){
                    clearTimeout(search_timeout);
                    search_timeout = setTimeout(function(){
                        self.perform_search(self.category, searchbox.value, event.which === 13);
                    },70);
                }
            };
        },
        events: {
	    	'click .button.back':'click_back',
	    	'click .button.btn_kanban':'click_kanban',
	    	'click .button.btn_list':'click_list',
	    	'click .button.btn_create_po':'click_create_po',
	    	'click .button.btn_receipt':'click_receipt'
	    },
        filter:"all",
        date: "all",
        click_back: function(){
        	this.gui.show_screen('products');
        },
        click_receipt: function(){
            var self = this;
            var order = self.pos.get_order();
            var list_product;
            order.set_receipt_mode(true);
            if(self.selected_product.length > 0){
                list_product = self.selected_product;
            }else{
                list_product = self.all_products;
            }
            if(list_product.length > 0){
                order.set_product_vals(list_product)
                if (self.pos.config.iface_print_via_proxy) {
                    var data = order.get_product_vals();
                    var receipt = "";
                    receipt = QWeb.render('OutStockProductXmlReceipt', {
                        widget: self,
                        pos: self.pos,
                        order: order,
                        receipt: order.export_for_printing(),
                        location_data: order.get_location_vals(),
                        product_data: data,
                    });
                   self.pos.proxy.print_receipt(receipt);
                   self.selected_product = [];
//                   self.gui.show_screen('products');
                }else{
                    self.gui.show_screen('receipt');
                }
            }
        },
        click_create_po: function(){
            var self = this;
            var order = self.pos.get_order();
            if(self.selected_product.length > 0){
                order.set_list_products(self.selected_product);
                this.gui.show_popup('create_purchase_order_popup',{'list_products':self.selected_product});
            } else{
                alert("Please Select Product!");
            }
        },
        start: function(){
        	var self = this;
        	self._super();
        	this.$('.manage_kanban_view').delegate('.out-stock-main-product','click',self.product_click);
        },
        render_products: function(products){
            var order = this.pos.get_order();
            var product;
            var stock_products = [];
            var location_id = $(".select_location_type").val();
            for(var i = 0, len = products.length; i < len; i++){
                product = products[i];
                if(location_id){
                    if(!product.is_dummy_product && product.type == 'product'){
                        stock_products.push(product)
                    }
                }else{
                    if(!product.is_dummy_product && product.type == 'product' && product.qty_available == 0){
                        stock_products.push(product)
                    }
                }
            }
            order.set_product_vals(stock_products)
        	$('.manage_kanban_view').html(QWeb.render('OutStockProductsList',{
            	widget: this,
            	products: stock_products}));
            $('.manage_list_view').html(QWeb.render('OutStockListView',{
                widget: this,
                products: stock_products}));
        },
        show: function(){
        	var self = this;
            this._super();
            var order = this.pos.get_order();
            var product;
            self.selected_product = [];
            self.all_products = [];
            $(".select_location_type").val("");
//            $('.product.main-product.header').hide();
            var all_products = this.pos.db.get_product_by_category(0)
            for(var i = 0, len = all_products.length; i < len; i++){
                product = all_products[i];
                if(!product.is_dummy_product && product.type == 'product' && product.qty_available == 0){
                	self.all_products.push(product)
                }
            }
            $('.out_stock_search_category input').val('');
            $('.searchbox input').val('');
            $('.searchbox input').focus();
            $('span.out_stock_category_clear').click(function(e){
            	self.clear_search();
            	var input = $('.out_stock_search_category input');
	            input.val('');
	            input.focus();

            });
            $(".select_location").on('change', function() {
                var location_id = $(".select_location_type").val();
                self.all_products = [];
                if(location_id){
                    var params = {
                        model: 'stock.location',
                        method: 'filter_location_wise_product',
                        args: [location_id],
                    }
                    rpc.query(params, {async: false}).then(function(res){
                        if(res){
                            var location_name = Object.keys(res)[0];
                            order.set_location_vals(location_name)
                             _.each(res, function(product_data) {
                                    if(product_data.length > 0){
                                        _.each(product_data, function(product_id) {
                                            var product_data = self.pos.db.get_product_by_id(product_id);
                                            self.all_products.push(product_data)
                                        });
                                    }
                             });
                             self.render_products(self.all_products);
                        }
                    });
                } else{
                    order.set_location_vals();
                    for(var i = 0, len = all_products.length; i < len; i++){
                        product = all_products[i];
                        if(!product.is_dummy_product && product.type == 'product'){
                            self.all_products.push(product)
                        }
                    }
                    self.render_products(self.all_products);
                }
            });
            this.render_products(all_products);
        },
        renderElement: function(){
        	var self = this;
        	self._super();
        	this.el.querySelector('.searchbox input').addEventListener('keypress',this.search_handler);

            this.el.querySelector('.searchbox input').addEventListener('keydown',this.search_handler);

            this.el.querySelector('.search-clear').addEventListener('click',this.clear_search_handler);

            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect($(this.el.querySelector('.searchbox input')));
            }
            $('.out_stock_search_category input', this.el).keyup(function(e){
    			if($(this).val() == ""){
                    var cat = self.pos.db.get_product_by_category(self.pos.db.root_category_id);
                    self.render_products(cat);
                }
                 $('.out_stock_search_category input').autocomplete({
                     source:self.pos.db.get_category_search_list(),
                     select: function(event, select_category){
                    	 if(select_category.item && select_category.item.id){
                         	var cat = self.pos.db.get_product_by_category(select_category.item.id);
                         	 self.render_products(cat);
                             var input = $('.out_stock_search_category input');
                             input.val(select_category.item.label);
                 		     input.focus();
                         }
                     },
                 });
    			e.stopPropagation();
            });
    		$('.out_stock_search_category input', this.el).keypress(function(e){
                $('.out_stock_search_category input').autocomplete({
                    source:self.pos.db.get_category_search_list(),
                    select: function(event, select_category){
                    	if(select_category.item && select_category.item.id){
                        	var cat = self.pos.db.get_product_by_category(select_category.item.id);
                        	self.render_products(cat);
                        	var input = $('.out_stock_search_category input');
                            input.val(select_category.item.label);
                		    input.focus();
                        }
                    },
                });
                e.stopPropagation();
            });

        },
    // empties the content of the search box
        clear_search: function(){
            var products = this.pos.db.get_product_by_category(0);
            this.render_products(products);
        },
        perform_search: function(category, query, buy_result){
            var products = this.pos.db.get_product_by_category(category);
            if(query){
            	products = this.pos.db.search_product(query);
            }
            this.render_products(products);
        },
        click_kanban: function(event){
        	$(event.currentTarget).addClass('highlight');
        	$('.btn_list').removeClass('highlight');
        	$('.out_stock_product_list_view').hide();
        	$('.out_stock_product_kanban_view').show();
        },
        click_list: function(event){
        	$(event.currentTarget).addClass('highlight');
        	$('.btn_kanban').removeClass('highlight');
        	$('.out_stock_product_kanban_view').hide();
        	$('.out_stock_product_list_view').show();
//        	$('.manage_list_view').html(QWeb.render('OutStockListView',{widget: self,products: self.all_products}));
        },
    });
    gui.define_screen({name:'product-out-of-stock', widget: OutStockProductsScreenWidget});

    var CustomerCreditListScreenWidget = screens.ScreenWidget.extend({
	    template: 'CustomerCreditListScreenWidget',
	    get_customer_list: function(){
        	return this.pos.get('customer_credit_list');
        },
        show: function(options){
        	var self = this;
        	this.reloading_orders(this.get_cust_id());
            self.date = "all";
            var records = self.pos.get('customer_credit_list');
            this._super();
            self.render_list(records);
        	if(records){
                var partner = this.pos.db.get_partner_by_id(this.get_cust_id());
                self.display_client_details(partner);
        	}
            $('.back').click(function(){
                self.gui.show_screen('clientlist');
            })
            self.reload_orders();
            this.$('.print-ledger').click(function(){
                var order = self.pos.get_order();
                order.set_ledger_click(true);
                self.gui.show_popup('cash_inout_statement_popup');
            });
	        $('input#datepicker').datepicker({
           	    dateFormat: 'yy-mm-dd',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function (dateText, inst) {
                	var date = $(this).val();
					if (date){
					    self.date = date;
					    self.render_list(self.get_customer_list());
					}
				},
				onClose: function(dateText, inst){
                    if( !dateText ){
                        self.date = "all";
                        self.render_list(self.get_customer_list());
                    }
                },
            }).focus(function(){
                var thisCalendar = $(this);
                $('.fa-times, .ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.date = "all";
                    self.render_list(self.get_customer_list());
                });
            });
            var old_goToToday = $.datepicker._gotoToday
            $.datepicker._gotoToday = function(id) {
                old_goToToday.call(this,id)
                this._selectDate(id)
            }
	    },
	    check_date_filter: function(records){
        	var self = this;
        	if(self.date !== "" && self.date !== "all"){
                var date_filtered_records = [];
            	for (var i=0; i<records.length;i++){
                    var date_record = $.datepicker.formatDate("yy-mm-dd",new Date(records[i].create_date));
            		if(self.date === date_record){
            			date_filtered_records.push(records[i]);
            		}
            	}
            	records = date_filtered_records;
            }
        	return records;
        },
	    render_list: function(records){
	        var self = this;
	        if(records && records.length > 0){
	            var contents = this.$el[0].querySelector('.credit-list-contents');
	            contents.innerHTML = "";
                if(self.date !== "" && self.date !== "all"){
	            	records = self.check_date_filter(records);
	            }
	            for(var i = 0, len = Math.min(records.length,1000); i < len; i++){
	                var self = this;
	                var record    = records[i];
	            	var clientline_html = QWeb.render('CreditlistLine',{widget: this, record:record});
	                var clientline = document.createElement('tbody');
	                clientline.innerHTML = clientline_html;
	                clientline = clientline.childNodes[1];
	                contents.appendChild(clientline);
	            }
        	} else{
        	    var contents = this.$el[0].querySelector('.credit-list-contents');
	            contents.innerHTML = "Record Not Found";
	            $("#pagination").hide();
        	}
        },
	    get_cust_id: function(){
            return this.gui.get_current_screen_param('cust_id');
        },
        reloading_orders: function(cust_id){
	    	var self = this;
	    	var partner = self.pos.db.get_partner_by_id(cust_id);
	    	var domain = []
	    	if(partner){
	    		if(partner.parent_id){
	    			partner = self.pos.db.get_partner_by_id(partner.parent_id[0]);
	    			domain.push(['partner_id','=',partner.id])
	    		} else{
	    			partner = self.pos.db.get_partner_by_id(cust_id)
	    			domain.push(['partner_id','=',partner.id])
	    		}
	    		var today = new Date();
	    		var end_date = moment(today).format('YYYY-MM-DD');
	    		var client_acc_id = partner.property_account_receivable_id;
	    		domain.push(['account_id','=',client_acc_id[0]],['date_maturity', '<=', end_date + " 23:59:59"]);
	    		var params = {
                    model: "account.move.line",
                    method: "search_read",
                    domain: domain,
                }
                rpc.query(params, {async: false})
                .then(function(records){
                	self.pos.set({'customer_credit_list' : records});
                    self.reload_orders();
                    return self.pos.get('customer_credit_list')
                });
	    	}
	    },
	    reload_orders: function(){
        	var self = this;
            var records = self.pos.get('customer_credit_list');
            this.search_list = []
            _.each(self.pos.partners, function(partner){
                self.search_list.push(partner.name);
            });
            _.each(records, function(record){
                self.search_list.push(record.display_name)
            });
            records = records.sort().reverse();
            this.render_list(records);
        },
        line_select: function(event,$line,id){
            var partner = this.pos.db.get_partner_by_id(id);
            this.$('.credit-list .lowlight').removeClass('lowlight');
                this.$('.credit-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                this.new_client = partner;
        },
        load_image_file: function(file, callback){
            var self = this;
            if (!file.type.match(/image.*/)) {
                this.gui.show_popup('error',{
                    title: _t('Unsupported File Format'),
                    body:  _t('Only web-compatible Image formats such as .png or .jpeg are supported'),
                });
                return;
            }

            var reader = new FileReader();
            reader.onload = function(event){
                var dataurl = event.target.result;
                var img     = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img,800,600,callback);
            };
            reader.onerror = function(){
                self.gui.show_popup('error',{
                    title :_t('Could Not Read Image'),
                    body  :_t('The provided file could not be read due to an unknown error'),
                });
            };
            reader.readAsDataURL(file);
        },
        display_client_details: function(partner, clickpos){
            var self = this;
            var contents = this.$('.credit-details-contents');
            contents.empty();
            var parent   = this.$('.order-list').parent();
            var scroll   = parent.scrollTop();
            var height   = contents.height();
//            var partner = Number($('.client-line.highlight').attr('data-id'));
            contents.append($(QWeb.render('CustomerCreditDisplay',{widget:this, partner: partner})));
            var new_height   = contents.height();
            if(!this.details_visible){
                parent.height('-=' + new_height);
                if(clickpos < scroll + new_height + 20 ){
                    parent.scrollTop( clickpos - 20 );
                }else{
                    parent.scrollTop(parent.scrollTop() + new_height);
                }
            }else{
                parent.scrollTop(parent.scrollTop() - height + new_height);
            }
            this.details_visible = true;
        },
        partner_icon_url: function(id){
            return '/web/image?model=res.partner&id='+id+'&field=image_small';
        },
    });
    gui.define_screen({name:'customercreditlistscreen', widget: CustomerCreditListScreenWidget});

});