odoo.define('flexipharmacy.popup', function (require) {
	"use strict";
	
	var gui = require('point_of_sale.gui');
	var rpc = require('web.rpc');
	var PosBaseWidget = require('point_of_sale.BaseWidget');
	var PopupWidget = require('point_of_sale.popups');
	var core = require('web.core');
	var chrome = require('point_of_sale.chrome');
	var models = require('point_of_sale.models');
	var framework = require('web.framework');
	var utils = require('web.utils');
	var field_utils = require('web.field_utils');
	var round_pr = utils.round_precision;
    var round_di = utils.round_decimals;

	var _t = core._t;
	var QWeb = core.qweb;

	//flexi alert popup
	var AlertPopupWidget = PopupWidget.extend({
	    template:'AlertPopupWidget',
	    show: function(options){
	        this._super(options);
	        this.gui.play_sound('bell');
	    },
	});
	gui.define_popup({name:'flexi_alert', widget: AlertPopupWidget});
	
	var AddressMapPopupWidget = PopupWidget.extend({
	    template: 'AddressMapPopupWidget',
	    show: function(options){
	    	var self = this;
	    	self._super(options);
	    	self.renderElement();
	    	self.options = options;
	    	$("#search_map_box_popup").focus(function() {
	    		if(navigator.onLine){
					geolocate();
				}
			});
	    	if(options.partner){
    			initpopupMap();
    			codeAddress(options.partner.address);
	    	}
	    },
	    click_confirm: function(){
	    	var self = this;
			var add_for_base_map = $("#search_map_box_popup").val();
			if(add_for_base_map){
				codeAddress(add_for_base_map);
				initMap();
				self._super();
			}
		},
		click_cancel: function(){
			this._super();
			codeAddress(this.options.partner.address);
			initMap();
		},
	});
	gui.define_popup({name:'map_popup', widget: AddressMapPopupWidget});

	var ProductNotePopupWidget = PopupWidget.extend({
	    template: 'ProductNotePopupWidget',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        this.renderElement();
	        var order    = this.pos.get_order();
	    	var selected_line = order.get_selected_orderline();
	    	$('textarea#textarea_note').focus();
	        $('textarea#textarea_note').html(selected_line.get_line_note());
	    },
	    click_confirm: function(){
	    	var order    = this.pos.get_order();
	    	var selected_line = order.get_selected_orderline();
	    	var value = this.$('#textarea_note').val();
	    	if(value){
	    		selected_line.set_line_note(value);
		    	this.gui.close_popup();
	    	} else {
	    		this.$('#textarea_note').focus();
	    	}
	    },
	    renderElement: function() {
            var self = this;
            this._super();
    	},
	});
	gui.define_popup({name:'add_note_popup', widget: ProductNotePopupWidget});

	var ReorderProductPopupWidget = PopupWidget.extend({
	    template: 'ReorderProductPopupWidget',
	    show: function(options){
	    	var self = this;
	    	options = options || {};
	    	var lines = options.order_lines || [];
	    	self.order_lines = [];
	    	_.each(lines,function(line){
	        	if(line.product_id[0]){
	        		var product = self.pos.db.get_product_by_id(line.product_id[0]);
//	        		if(product && self.pos.get_order().is_sale_product(product)){
	        		if(product && !product.is_dummy_product){
	        			self.order_lines.push(line);
	        		}
	        	}
	        });
	        self.old_order = options.old_order || "";
	        self._super(options);
	        self.renderElement();
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	var selected_ids = [];
	    	var flag = false;
	    	$('.line-selected').map(function(ev){
	    		var id = parseInt($(this).attr('id'));
	    		if(id){
	    			selected_ids.push(id);
	    		}
	    	});
	    	if(selected_ids && selected_ids[0]){
	    		order.destroy();
		    	var order = self.pos.get_order();
	    		selected_ids.map(function(id){
	    			var line = _.find(self.order_lines, function(obj) { return obj.id == id});
	    			var qty = Number($(".popup-product-list tbody").find('tr#'+id+'').find('.js_quantity').val());
	    			if(line && qty > 0){
	    				if(line.product_id && line.product_id[0]){
	    					var product = self.pos.db.get_product_by_id(line.product_id[0]);
	    					if(product && order.is_sale_product(product)){
//	    					if(product && !product.is_dummy_product){
	    						flag = true;
	    						order.add_product(product, {
			    					quantity: qty,
			    				});
	    					}
	    				}
	    			}
	    		});
	    		if(flag){
	    			if(self.old_order && self.old_order.partner_id && self.old_order.partner_id[0]){
	    				var partner = self.pos.db.get_partner_by_id(self.old_order.partner_id[0]);
	    				if(partner){
	    					order.set_client(partner);
	    				}
	    			}else{
	    				order.set_client(null);
	    			}
	    			self.gui.close_popup();
	    			self.gui.show_screen("products");
	    		}
	    	}
	    },
	    renderElement: function() {
            var self = this;
            this._super();
            $('.js_quantity-reorder').click(function(ev){
	    		ev.preventDefault();
	            var $link = $(ev.currentTarget);
	            var $input = $link.parent().parent().find("input");
	            var min = parseFloat($input.data("min") || 1);
	            var max = parseFloat($input.data("max") || $input.val());
	            var total_qty = parseFloat($input.data("total-qty") || 0);
	            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(),10);
	            $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
	            $input.change();
	            return false;
	    	});
            $('.product_line').click(function(event){
            	if($(this).hasClass('line-selected')){
            		$(this).removeClass('line-selected');
            	}else{
            		$(this).addClass('line-selected');
            	}
            });
            $('.remove_line').click(function(){
            	$(this).parent().remove();
            	if($('.product_line').length == 0){
            		self.gui.close_popup();
            	}
            });
    	},
	});
	gui.define_popup({name:'duplicate_product_popup', widget: ReorderProductPopupWidget});

	var CreateProductPopupWidget = PopupWidget.extend({
	    template: 'CreateProductPopupWidget',
	    show: function(options){
	    	var self = this;
	    	self._super(options);
	    	self.renderElement();
	    	self.uploaded_picture = null;
	    	$('#prod_name').focus();
	    },
	    click_confirm: function(){
	    	var self = this;
	    	self.save_product_details();
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
	    resize_image_to_dataurl: function(img, maxwidth, maxheight, callback){
	        img.onload = function(){
	            var canvas = document.createElement('canvas');
	            var ctx    = canvas.getContext('2d');
	            var ratio  = 1;

	            if (img.width > maxwidth) {
	                ratio = maxwidth / img.width;
	            }
	            if (img.height * ratio > maxheight) {
	                ratio = maxheight / img.height;
	            }
	            var width  = Math.floor(img.width * ratio);
	            var height = Math.floor(img.height * ratio);

	            canvas.width  = width;
	            canvas.height = height;
	            ctx.drawImage(img,0,0,width,height);

	            var dataurl = canvas.toDataURL();
	            callback(dataurl);
	        };
	    },
	    save_product_details: function() {
	    	var self = this;
	        var fields = {};
	        this.$('.product-data .detail').each(function(idx,el){
	            fields[el.name] = el.value || false;
	        });
	        if (self.uploaded_picture) {
	            fields['image'] = self.uploaded_picture;
	        }
	        if (!fields.name) {
	        	self.pos.db.notification('danger',_t('A Product Name Is Required'));
	        	$('#prod_name').focus();
	        	this.$('#prod_name').animate({
            	    color: 'red',
            	}, 1000, 'linear', function() {
            	      $(this).css('color','#555');
            	});
	        } else {
	        	var params = {
						model: 'product.template',
						method: 'create_from_ui',
						args: [fields],
					}
				rpc.query(params, {async: false}).then(function(product_id){
		        	if(product_id){
		        		self.pos.load_new_products()
	        			var product = self.pos.db.get_product_by_id(product_id);
	        			if(product){
	        				var all_products = self.pos.db.get_product_by_category(0);
	    					$('.product_list_manage').html(QWeb.render('ProductList',{widget: self,products: all_products}));
	            			self.gui.show_popup('show_product_popup',{'product':product});
	            		}
		        	}
		        }).fail(function (type, error){
		        	if(error.data && error.data.message){
						self.pos.db.notification('danger',error.data.message);
					} else {
						self.pos.db.notification('danger','Connection lost');
					}
				});
	        }
	    },
	    renderElement: function(){
	    	var self = this;
	    	self._super();
	    	$('.product-image-uploader').on('change',function(event){
                self.load_image_file(event.target.files[0],function(res){
                    if (res) {
                    	self.uploaded_picture = res;
                    	$('.create-product-img').html('');
                    	$('.create-product-img').append("<img src='"+res+"'>");
                    }
                });
            });
	    },
	});
	gui.define_popup({name:'create_product_popup', widget: CreateProductPopupWidget});

	var ShowProductPopupWidget = PopupWidget.extend({
	    template: 'ShowProductPopupWidget',
	    show: function(options){
	    	var self = this;
	        options = options || {};
	        self.product = options.product;
	        self.uploaded_picture = null;
	        this._super(options);
	        this.renderElement();
	    },
	    renderElement: function() {
            var self = this;
            this._super();
            $('.edit-product').click(function(){
            	if($(this).parent().parent().find('.details-container').hasClass('edit-current-product')){
    				$(this).children().removeClass('fa-floppy-o').addClass('fa-pencil-square-o');
    				$(this).parent().parent().find('.details-container').removeClass('edit-current-product');
    				$(this).parent().parent().find('.product-details-box .product-detail .label-value').css("display","block");
    				$(this).parent().parent().find('.product-details-box .product-detail input').css("display","none");
    				$(this).parent().parent().find('.product-details-box .product-detail select').css("display","none");
    				self.save_product();
    			}else{
    				$(this).children().removeClass('fa-pencil-square-o').addClass('fa-floppy-o');
    				$(this).parent().parent().find('.details-container').addClass('edit-current-product');
    				$(this).parent().parent().find('.product-details-box .product-detail .label-value').css("display","none");
    				$(this).parent().parent().find('.product-details-box .product-detail input').css("display","block");
    				$(this).parent().parent().find('.product-details-box .product-detail select').css("display","block");
    			}
            });
            $('.edit-product-image-uploader').on('change',function(event){
                self.load_image_file(event.target.files[0],function(res){
                    if (res) {
                    	self.uploaded_picture = res;
                    	$('.create-product-img').html('');
                    	$('.create-product-img').append("<img src='"+res+"'>");
                    }
                });
            });
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
	    resize_image_to_dataurl: function(img, maxwidth, maxheight, callback){
	        img.onload = function(){
	            var canvas = document.createElement('canvas');
	            var ctx    = canvas.getContext('2d');
	            var ratio  = 1;

	            if (img.width > maxwidth) {
	                ratio = maxwidth / img.width;
	            }
	            if (img.height * ratio > maxheight) {
	                ratio = maxheight / img.height;
	            }
	            var width  = Math.floor(img.width * ratio);
	            var height = Math.floor(img.height * ratio);

	            canvas.width  = width;
	            canvas.height = height;
	            ctx.drawImage(img,0,0,width,height);

	            var dataurl = canvas.toDataURL();
	            callback(dataurl);
	        };
	    },
    	save_product: function(){
    		var self = this;
    		var fields = {};
    		$('.product-data .detail').each(function(idx,el){
    			if(el.name != 'name'){
    				fields[el.name] = el.value || false;
    			}
	        });
    		if (self.uploaded_picture) {
	            fields['image'] = self.uploaded_picture.split(',')[1];
	        }
    		var params = {
				model: 'product.product',
				method: 'write',
				args: [self.product.id,fields],
			}
			rpc.query(params, {async: false}).then(function(result){
				if(result){
					for (var key in fields) {
						if(key == 'categ_id'){
							var product_categories = self.pos.product_categories;
							var prod_categ = _.find(product_categories, function(product_category) { return product_category.id == fields[key]});
							if(prod_categ){
								self.product['categ_id'] = [prod_categ.id, prod_categ.name];
							}
						} else if(key == 'pos_categ_id'){
							var pos_categories = self.pos.db.get_all_categories();
							var pos_categ = _.find(pos_categories, function(pos_category) { return pos_category.id == fields[key]});
							if(pos_categ){
								self.product['pos_categ_id'] = [pos_categ.id, pos_categ.name];
							}
						} else {
							self.product[key] = fields[key];
						}
					}
					self.pos.db.notification('success',_t('Product saved successfully.'));
					self.renderElement();
					var all_products = self.pos.db.get_product_by_category(0);
					$('.product_list_manage').html(QWeb.render('ProductList',{widget: self,products: all_products}));
				}
			}).fail(function (type, error){
				if(error.data && error.data.message){
					self.pos.db.notification('danger',error.data.message);
				} else {
					self.pos.db.notification('danger','Connection lost');
				}
				$('.edit-product').children().removeClass('fa-pencil-square-o').addClass('fa-floppy-o');
				$('.edit-product').parent().parent().find('.details-container').addClass('edit-current-product');
				$('.edit-product').parent().parent().find('.product-details-box .product-detail .label-value').css("display","none");
				$('.edit-product').parent().parent().find('.product-details-box .product-detail input').css("display","block");
				$('.edit-product').parent().parent().find('.product-details-box .product-detail select').css("display","block");
			});
    	},
	});
	gui.define_popup({name:'show_product_popup', widget: ShowProductPopupWidget});

    var ProductQtyPopupWidget = PopupWidget.extend({
	    template: 'ProductQtyPopupWidget',
	    show: function(options){
	        options = options || {};
	        this.prod_info_data = options.prod_info_data || '';
	        this.total_qty = options.total_qty || '';
	        this._super(options);
	        this.renderElement();
	    },
	});
	gui.define_popup({name:'product_qty_popup', widget: ProductQtyPopupWidget});
	
	/*Return order*/
	var PosReturnOrderOption = PopupWidget.extend({
	    template: 'PosReturnOrderOption',
	    show: function(options){
	    	var self = this;
	        options = options || {};
	        this._super(options);
	        this.renderElement();
	        $('.close_btn').click(function(){
	        	var selectedOrder = self.pos.get_order();
        		if(selectedOrder){
        			$("div#sale_mode").click();
        		}
	        	self.gui.close_popup(); 
	        });
	        $('#choice_without_receipt').click(function(event){
        		var selectedOrder = self.pos.get_order();
        		if(selectedOrder){
	                selectedOrder.change_mode('missing');
	                self.gui.close_popup();
        		}
	        });
	        $('#choice_with_receipt').click(function(){
	        	self.gui.close_popup();
	        	self.gui.show_popup('pos_return_order');
	        });
	    },
	});
	gui.define_popup({name:'PosReturnOrderOption', widget: PosReturnOrderOption});
	
	var PosReturnOrder = PopupWidget.extend({
	    template: 'PosReturnOrder',
	    init: function(parent, args) {
	    	var self = this;
	        this._super(parent, args);
	        this.options = {};
	        this.line = [];
	        this.select_item = function(e){
	        	self.selected_item($(this).parent());
	        };
	        this.update_return_product_qty = function(ev){
	        	ev.preventDefault();
	            var $link = $(ev.currentTarget);
	            var $input = $link.parent().parent().find("input");
	            var product_elem = $('.product_content[data-line-id="'+$input.attr("name")+'"]')
	            if(!product_elem.hasClass('select_item')){
	            	product_elem.addClass('select_item')
	            }
	            var min = parseFloat($input.data("min") || 0);
	            var max = parseFloat($input.data("max") || $input.val());
	            var total_qty = parseFloat($input.data("total-qty") || 0);
	            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(),10);
	            $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
	            $input.change();
	            return false;
	        };
	        this.keypress_order_number = function(e){
	        	if(e.which === 13){
	        		var selectedOrder = self.pos.get_order();
	        		var domain;
	        		var ret_o_ref = $("input#return_order_number").val();
	        		if (ret_o_ref.indexOf('Order') == -1) {
	                    var ret_o_ref_order = _t('Order ') + ret_o_ref.toString();
	                }
	                if(self.pos.config.multi_shop_id && self.pos.config.multi_shop_id[0]){
	        			domain = ['|',['shop_id','=',self.pos.config.multi_store_id[0]],['shop_id','=',false],['pos_reference','=', ret_o_ref_order]];
	        		} else{
	        			domain = [['pos_reference', '=', ret_o_ref_order]];
	        		}
	        		if (ret_o_ref.length > 0) {
	        			var params = {
        	            	model: 'pos.order',
        	            	method: 'search_read',
        	            	domain: domain,
        	            	fields: [],
        	            }
	        			return rpc.query(params, {async: false}).then(function(result){
                        	if (result && result.length > 0) {
                        		if(result[0].state == 'draft' || result[0].state == 'cancel'){
                        			return self.pos.db.notification('danger',_t('Sorry, You can not return unpaid/cancel order'));
                        		}
                        		selectedOrder.set_ret_o_id(result[0].id);
                                selectedOrder.set_ret_o_ref(result[0].pos_reference);
                                if(result[0].partner_id){
                                	var partner = self.pos.db.get_partner_by_id(result[0].partner_id[0]) 
                                	selectedOrder.set_client(partner);
                                }
                                var orderline_params = {
                	            	model: 'pos.order.line',
                	            	method: 'search_read',
                	            	domain: [['order_id', '=', result[0].id],['return_qty', '>', 0]],
                	            }
                                return rpc.query(orderline_params, {async: false}).then(function(res){
                                	if(res && res.length > 0){
	                                	var lines = [];
	                                    _.each(res,function(r) {
	                                    	var prod = self.pos.db.get_product_by_id(r.product_id[0]);
//	                                    	if(prod && selectedOrder.is_sale_product(prod)){
	                                    	if(prod && !prod.is_dummy_product){
	                                    		lines.push(r);
		                                    	self.line[r.id] = r;
	                                    	}
	                                    });
	                                    self.lines = lines;
	                                    self.renderElement();
                                	} else {
                                		self.pos.db.notification('danger',_t('No item found'));
                                		$('.ac_product_list').empty();
                                	}
                                }).fail(function(){
                                	self.pos.db.notification('danger',"Connection lost");
                                });
                        	} else {
                        		self.pos.db.notification('danger',_t('No result found'));
                        		$('.ac_product_list').empty();
                        	}
                        }).fail(function(){
                        	self.pos.db.notification('danger',"Connection lost");
                        });
	        		}
	        	}
	        };
	        this.keydown_qty = function(e){
	        	if($(this).val() > $(this).data('max')){
	        		$(this).val($(this).data('max'))
	        	}
	        	if($(this).val() < $(this).data('min')){
	        		$(this).val($(this).data('min'))
	        	}
	        };
	    },
	    selected_item: function($elem){
	    	var self = this;
	    	if($elem.hasClass('select_item')){
	    		$elem.removeClass('select_item')
	    	} else {
	    		$elem.addClass('select_item')
	    	}
	    },
	    show: function(options){
	    	var self = this;
	        options = options || {};
	        this._super(options);
	        $("input#return_order_number").focus();
	        $('.ac_product_list').empty();
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var selectedOrder = this.pos.get_order();
	    	if(selectedOrder.get_ret_o_id()){
	    		var not_allow = true;
	    		if($('.select_item').length > 0){
		            _.each($('.select_item'), function(item){
	            		var orderline = self.line[$(item).data('line-id')];
	            		var input_val = $(item).find('input.return_product_qty[name='+orderline.id+']').val()
	            		if(input_val > 0 && input_val <= orderline.return_qty){
	            			not_allow = false;
	            			var product = self.pos.db.get_product_by_id(orderline.product_id[0]);
		            		var line = new models.Orderline({}, {pos: self.pos, order: selectedOrder, product: product});
		                    line.set_quantity($('input[name="'+orderline.id+'"').val() * -1);
		                    line.set_unit_price(orderline.price_unit);
		                    line.set_oid(orderline.order_id);
		                    if(orderline.discount){
		                    	line.set_discount(orderline.discount)
		                    }
		                    line.set_back_order(selectedOrder.get_ret_o_ref());
		                    selectedOrder.add_orderline(line);
	            		}
		            });
		            if(not_allow){
			            return
		            }
		            $('#return_order_ref').html(selectedOrder.get_ret_o_ref());
		            this.gui.close_popup();
	    		}
	    	}else{
		    	$("input#return_order_number").focus();
	    	}
	    },
	    click_cancel: function(){
	        $("div#sale_mode").trigger('click');
	        var selectedOrder = this.pos.get_order(); 
	        selectedOrder.set_ret_o_id(null);
            selectedOrder.set_ret_o_ref(null);
	    	this.gui.close_popup();
	    },
	    get_product_image_url: function(product_id){
    		return window.location.origin + '/web/binary/image?model=product.product&field=image_medium&id='+product_id;
    	},
    	renderElement: function(){
            this._super();
            this.$('.return_product .input-group-addon').delegate('a.js_return_qty','click', this.update_return_product_qty);
            this.$('div.content').delegate('#return_order_number','keypress', this.keypress_order_number);
            this.$('div.input-group').delegate('.js_quantity','input', this.keydown_qty);
            this.$('.ac_product_list').delegate('.product-img','click', this.select_item);
    	}
	});
	gui.define_popup({name:'pos_return_order', widget: PosReturnOrder});

	var POSSessionConfig = PopupWidget.extend({
	    template: 'POSSessionConfig',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        this.renderElement();
	    },
	    renderElement: function() {
            var self = this;
            this._super();
//            $('.close-pos').click(function(){
//            	self.gui.close_popup();
//    	    	self.gui.close();
//            });
            $('.logout-pos').click(function(){
            	framework.redirect('/web/session/logout');
            });
            $('.close-popup-btn').click(function(){
            	self.gui.close_popup();
            });
            $('.close-pos-session').click(function(){
        		if(self.pos.config.cash_control){
                    self.gui.show_popup('cash_control',{
                        title:'Closing Cash Control',
                        statement_id:self.statement_id,
                    });
                }else{
                	var cashier = self.pos.get_cashier() || false;
                	if(!cashier){
                		cashier = self.pos.user;
                	}
                	if(cashier.login_with_pos_screen){
	                    var params = {
	                        model: 'pos.session',
	                        method: 'custom_close_pos_session',
	                        args:[self.pos.pos_session.id]
	                    }
	                    rpc.query(params, {async: false}).then(function(res){
	                        if(res){
	                        	if(cashier.login_with_pos_screen){
	                        		framework.redirect('/web/session/logout');
	                        	}
	                        }
	                    });
                	}else{
                    	self.gui.close();
                	}
                }
            });
    	},
	});
	gui.define_popup({name:'POS_session_config', widget: POSSessionConfig});

	var BagSelectionPopupWidget = PopupWidget.extend({
	    template: 'BagSelectionPopupWidget',
	    init: function(parent, args) {
	    	var self = this;
	        this._super(parent, args);
	        this.options = {};
	        this.select_item = function(e){
	        	self.selected_item($(this).parent());
	        };
	        this.update_bag_qty = function(ev){
	        	ev.preventDefault();
	            var $link = $(ev.currentTarget);
	            var $input = $link.parent().parent().find("input");
	            var product_elem = $('.product_content[data-product-id="'+$input.attr("prod-id")+'"]')
	            if(!product_elem.hasClass('select_item')){
	            	product_elem.addClass('select_item')
	            }
	            var min = parseFloat($input.data("min") || 0);
	            var max = parseFloat($input.data("max") || $input.val());
	            var total_qty = parseFloat($input.data("total-qty") || 0);
	            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(),10);
	            $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
	            $input.change();
	            self.count_bag_total();
	            return false;
	        };
	        this.keydown_qty = function(e){
	        	var opp_elem;
	        	var product_elem = $('.product_content[data-line-id="'+$(e.currentTarget).attr("name")+'"]')
	            if(!product_elem.hasClass('select_item')){
	            	product_elem.addClass('select_item')
	            }
	        	self.count_bag_total();
	        };
	    },
	    selected_item: function($elem){
	    	var self = this;
	    	if($elem.hasClass('select_item')){
	    		$elem.removeClass('select_item')
	    	} else {
	    		$elem.addClass('select_item')
	    	}
	    	if($('.select_item').length != 0){
	    		$('#sub_container').show();
	    		$('#chk_bag_charges').prop('checked', true);
	    	} else {
	    		$('#chk_bag_charges').prop('checked', false);
	    		$('#sub_container').hide();
	    	}
	    	self.count_bag_total();
	    },
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        $('#sub_container').hide();
	        $('#bag_charges_total').html("Total: "+this.format_currency(0));
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	$('.select_item').each(function(index,el){
    			var product = self.pos.db.get_product_by_id($(this).attr('data-product-id'));
    			if(product){
    				var input_qty = $("#"+product.id).val();
    				if(input_qty > 0){
    					var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                        line.set_quantity(input_qty);
                        line.set_unit_price(0);
                        if($('#chk_bag_charges').prop('checked')){
                        	line.set_unit_price(product.list_price);
                        }
                        line.set_bag_color(true);
                        line.set_is_bag(true);
                        order.add_orderline(line);
    				}
    			}
    		});
	        if($('.select_item').length != 0){
	    		self.gui.close_popup();
	    	}
	    },
	    renderElement: function() {
            var self = this;
            this._super();
            this.$('.bag_product .input-group-addon').delegate('a.js_qty','click', this.update_bag_qty);
            this.$('div.input-group').delegate('.js_quantity','input', this.keydown_qty);
            this.$('.ac_product_list').delegate('.product-img','click', this.select_item);
            
            $('#chk_bag_charges').change(function(){
            	self.count_bag_total();
            });
	    },
    	count_bag_total: function(){
    		var self = this;
    		var total = 0;
    		if($('#chk_bag_charges').prop('checked')){
    			$('table.total .bag_value').text("");
        		$('.select_item').each(function(index,el){
        			var prod = self.pos.db.get_product_by_id($(this).attr('data-product-id'));
        			if(prod){
        				self.input_qty = $("#"+prod.id).val();
        				if(self.input_qty && prod.list_price){
        					total += self.input_qty*prod.list_price;
        				}
        			}
        		});
    		}
    		$('#bag_charges_total').html("Total: "+self.format_currency(total));
    	},
    	get_product_image_url: function(product_id){
    		return window.location.origin + '/web/image?model=product.product&field=image_medium&id='+product_id;
    	},
	});
	gui.define_popup({name:'bags_popup', widget: BagSelectionPopupWidget});

	var ComformDeliveryPopupWidget = PopupWidget.extend({
	    template: 'ComformDeliveryPopupWidget',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        this.renderElement();
	    },
	    click_confirm: function(){
	        var order = this.pos.get_order();
	        var lines = order.get_orderlines();
	        var list = []
	        for(var i=0;i<lines.length;i++){
	        	lines[i].set_deliver_info(false);
	        	if(lines[i].get_delivery_charges_flag()){
	        		list.push(lines[i]);
	        	}
	        }
	        for(var j=0;j<list.length;j++){
	        	order.remove_orderline(list[j]);
				order.set_is_delivery(false);
	        }
	        $('#delivery_mode').removeClass('deliver_on');
	        this.gui.close_popup();
	        self.pos.chrome.screens.payment.render_paymentlines();
	    },
	    renderElement: function() {
            var self = this;
            this._super();
	    	this.$('.cancel').click(function(){
	    		self.gui.close_popup();
//	    		self.gui.show_screen('products');
	        });
    	},
	});
	gui.define_popup({name:'conf_delivery', widget: ComformDeliveryPopupWidget});
	
    var RedeemLoyaltyPointsPopup = PopupWidget.extend({
	    template: 'RedeemLoyaltyPointsPopup',
	    show: function(options){
	    	var self = this;
	    	this.payment_self = options.payment_self;
	    	this._super(options);
	    	var order = self.pos.get_order();
	    	var fields = _.find(this.pos.models,function(model){ return model.model === 'res.partner'; }).fields;
	    	var params = {
	    		model: 'res.partner',
	    		method: 'search_read',
	    		domain: [['id', '=', order.get_client().id]],
	    		fields: fields,
	    	}
	    	rpc.query(params, {async: false})
	    	.then(function(partner){
	    		if(partner.length > 0){
	    			var exist_partner = self.pos.db.get_partner_by_id(order.get_client().id);
	    			_.extend(exist_partner, partner[0]);
	    		}
	    	}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
	    	$('body').off('keypress', this.payment_self.keyboard_handler);
        	$('body').off('keydown',this.payment_self.keyboard_keydown_handler);
	    	window.document.body.removeEventListener('keypress',this.payment_self.keyboard_handler);
	    	window.document.body.removeEventListener('keydown',this.payment_self.keyboard_keydown_handler);
	    	self.renderElement();
	    	$('.redeem_loyalty_input').focus();
	    },
	    click_confirm: function(){
	    	var self =this;
	    	var order = this.pos.get_order();
	    	var redeem_point_input = $('.redeem_loyalty_input');
	    	if(redeem_point_input.val() && $.isNumeric(redeem_point_input.val()) 
	    			&& Number(redeem_point_input.val()) > 0){
	    		var remaining_loyalty_points = order.get_client().remaining_loyalty_points - order.get_loyalty_redeemed_point();
	    		if(Number(redeem_point_input.val()) <= remaining_loyalty_points){
	    			var amount_to_redeem = (Number(redeem_point_input.val()) * self.pos.loyalty_config.to_amount) / self.pos.loyalty_config.points;
	    			if(amount_to_redeem <= (order.get_due() || order.get_total_with_tax())){
			    		if(self.pos.config.loyalty_journal_id){
				    		var loyalty_cashregister = _.find(self.pos.cashregisters, function(cashregister){
				    			return cashregister.journal_id[0] === self.pos.config.loyalty_journal_id[0] ? cashregister : false;
				    		});
				    		if(loyalty_cashregister){
				    			order.add_paymentline(loyalty_cashregister);
				    			order.selected_paymentline.set_amount(amount_to_redeem);
				    			order.selected_paymentline.set_loyalty_point(Number(redeem_point_input.val()));
				    			order.selected_paymentline.set_freeze_line(true);
				    			self.payment_self.reset_input();
				    			self.payment_self.render_paymentlines();
				    			order.set_loyalty_redeemed_point(Number(order.get_loyalty_redeemed_point()) + Number(redeem_point_input.val()));
				    			order.set_loyalty_redeemed_amount(order.get_loyalty_amount_by_point(order.get_loyalty_redeemed_point()));
				    			this.gui.close_popup();
				    		}
			    		} else {
			    			self.pos.db.notification('danger',_t("Please configure Journal for Loyalty in Point of sale configuration."));
			    		}
	    			}
	    		} 
	    	}
	    },
	    renderElement: function(){
	    	var self = this;
	    	this._super();
	    	var order = self.pos.get_order();
	    	if(self.el.querySelector('.redeem_loyalty_input')){
		    	self.el.querySelector('.redeem_loyalty_input').addEventListener('keyup', function(e){
		    		if($.isNumeric($(this).val())){
		    			var val = this.value;
		    	        var re = /^([0-9]+[\.]?[0-9]?[0-9]?|[0-9]+)$/g;
		    	        var re1 = /^([0-9]+[\.]?[0-9]?[0-9]?|[0-9]+)/g;
		    	        if (re.test(val)) {
		    	            //do something here
		    	        } else {
		    	            val = re1.exec(val);
		    	            if (val) {
		    	                this.value = val[0];
		    	            } else {
		    	                this.value = "";
		    	            }
		    	        }
		    			var remaining_loyalty_points = order.get_client().remaining_loyalty_points - order.get_loyalty_redeemed_point();
		    			var amount = order.get_loyalty_amount_by_point(Number($(this).val()));
		    			$('.point_to_amount').text(self.format_currency(amount));
		    			if(Number($(this).val()) > remaining_loyalty_points){
		    				self.pos.db.notification('danger',_t('Can not redeem more than your remaining points.'));
		    				$(this).val(0);
		    				$('.point_to_amount').text('0.00');
		    			}
		    			if(amount > (order.get_due() || order.get_total_with_tax())){
		    				self.pos.db.notification('danger',_t('Loyalty Amount exceeding Due Amount.'));
		    				$(this).val(0);
		    				$('.point_to_amount').text('0.00');
		    			}
		    		} else {
		    			$('.point_to_amount').text('0.00');
		    		}
		    	});
	    	}
	    },
	    close: function(){
	    	$('body').keypress(this.payment_self.keyboard_handler);
	        $('body').keydown(this.payment_self.keyboard_keydown_handler);
	    	window.document.body.addEventListener('keypress',this.payment_self.keyboard_handler);
	    	window.document.body.addEventListener('keydown',this.payment_self.keyboard_keydown_handler);
	    },
    });
    gui.define_popup({name:'redeem_loyalty_points', widget: RedeemLoyaltyPointsPopup});

    var TodayPosReportPopup = PopupWidget.extend({
	    template: 'TodayPosReportPopup',
	    show: function(options){
	    	this.str_main = options.str_main || "";
	    	this.str_payment = options.str_payment || "";
	        options = options || {};
	        this._super(options);
	        this.session_total = options.result['session_total'] || [];
	        this.payment_lst = options.result['payment_lst'] || [];
	        this.all_cat = options.result['all_cat'] || [];
	        this.renderElement();
	        $(".tabs-menu a").click(function(event) {
		        event.preventDefault();
		        $(this).parent().addClass("current");
		        $(this).parent().siblings().removeClass("current");
		        var tab = $(this).attr("href");
		        $(".tab-content").not(tab).css("display", "none");
		        $(tab).fadeIn();
		    });
	    },
	    renderElement: function() {
            var self = this;
            this._super();
    	},
	});
	gui.define_popup({name:'pos_today_sale', widget: TodayPosReportPopup});

	var CreateCardPopupWidget = PopupWidget.extend({
        template: 'CreateCardPopupWidget',

        show: function(options){
            var self = this;
            this._super(options);
            self.partner_id = '';
            options = options || {};
            self.panding_card = options.card_data || false;
            this.renderElement();
            $('#card_no').focus();
            var timestamp = new Date().getTime()/1000;
            var partners = this.pos.db.all_partners;
            var partners_list = [];
            if(self.pos.config.default_exp_date && !self.panding_card){
            	var date = new Date();
            	date.setMonth(date.getMonth() + self.pos.config.default_exp_date);
            	var new_date = date.getFullYear()+ "/" +(date.getMonth() + 1)+ "/" +date.getDate();
            	self.$('#text_expire_date').val(new_date);
            }
            if(partners && partners[0]){
            	partners.map(function(partner){
            		partners_list.push({
            			'id':partner.id,
            			'value':partner.name,
            			'label':partner.name,
            		});
            	});
            	$('#select_customer').keypress(function(e){
	            	$('#select_customer').autocomplete({
	                    source:partners_list,
	                    select: function(event, ui) {
	                    	self.partner_id = ui.item.id;
	                    },
	                });
            	});
            	if(self.panding_card){
            		self.partner_id = self.panding_card.giftcard_customer;
            		$('#checkbox_paid').prop('checked',true);
            	}
            }
            $("#text_amount").keypress(function (e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
               }
            });
            if(self.pos.config.manual_card_number && !self.panding_card){
            	$('#card_no').removeAttr("readonly");
            	$("#card_no").keypress(function (e) {
                    if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                        return false;
                   }
                });
            } else if(!self.panding_card){
            	$('#card_no').val(window.parseInt(timestamp));
            	$('#card_no').attr("readonly", "readonly");
            }
            var partner = null;
            for ( var j = 0; j < self.pos.partners.length; j++ ) {
                partner = self.pos.partners[j];
                self.partner=this.partner
            }
        },

        click_confirm: function(){
            var self = this;
            var move = true;
            var order = self.pos.get_order();
            var checkbox_paid = document.getElementById("checkbox_paid");
            var expire_date = this.$('#text_expire_date').val();
            var select_customer = self.partner_id;
            var select_card_type = $('#select_card_type').val();
        	var card_number = $('#card_no').val();
        	if(!card_number){
        		self.pos.db.notification('danger',_t('Please enter gift card number.'));
        		return;
        	} else{
        		var params = {
                    	model: 'aspl.gift.card',
                    	method: 'search_read',
                    	domain: [['card_no', '=', $('#card_no').val()]],
                    }
                rpc.query(params, {async: false}).then(function(gift_count){
                	gift_count = gift_count.length;
                    if(gift_count > 0){
                        $('#card_no').css('border', 'thin solid red');
                        move = false;
                    } else{
                    	$('#card_no').css('border', '0px');
                    }
                }).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
        	}
        	if(!move){
        		self.pos.db.notification('danger',_t('Card already exist.'));
        		return
        	}
            if(self.partner_id){
        		var client = self.pos.db.get_partner_by_id(self.partner_id);
        	}
    		if(expire_date){
                if(checkbox_paid.checked){
                    $('#text_amount').focus();
                    var input_amount =this.$('#text_amount').val();
                    if(input_amount){
                        order.set_client(client);
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (self.pos.config.gift_card_product_id[0]){
                        	order.empty_cart()
                            var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            line.set_unit_price(input_amount);
                            order.add_orderline(line);
                            order.select_orderline(order.get_last_orderline());
                        }
                        var gift_order = {'giftcard_card_no': $('#card_no').val(),
                            'giftcard_customer': select_customer ? select_customer : false,
                            'giftcard_expire_date': $('#text_expire_date').val(),
                            'giftcard_amount': $('#text_amount').val(),
                            'giftcard_customer_name': $("#select_customer").val(),
                            'card_type': $('#select_card_type').val(),
                        }
                        if(self.pos.config.msg_before_card_pay) {
                        	self.gui.show_popup('confirmation_card_payment',{'card_data':gift_order});
                        } else{
                        	order.set_giftcard(gift_order);
                        	self.gui.show_screen('payment');
                        	$("#card_back").hide();
                            $( "div.js_set_customer" ).off("click");
                            $( "div#card_invoice" ).off("click");
                            this.gui.close_popup(); 
                        }
                    }else{
                        self.pos.db.notification('danger',_t('Please enter card value.'));
                        $('#text_amount').focus();
                    }
                }else{
                    var input_amount =this.$('#text_amount').val();
                    if(input_amount){
                        order.set_client(self.pos.db.get_partner_by_id(self.partner_id));
                        order.set_free_data({
                            'giftcard_card_no': $('#card_no').val(),
                            'giftcard_customer': select_customer ? select_customer : false,
                            'giftcard_expire_date': $('#text_expire_date').val(),
                            'giftcard_amount': $('#text_amount').val(),
                            'giftcard_customer_name': $("#select_customer").val(),
                            'card_type': $('#select_card_type').val(),
                        })
                        var params = {
                        	model: "aspl.gift.card",
                        	method: "create",
                        	args: [{
                        		'card_no': Number($('#card_no').val()),
                        		'card_value':  Number($('#text_amount').val()),
                        		'customer_id':self.partner_id ? Number(self.partner_id) : false,
                        		'expire_date':$('#text_expire_date').val(),
                        		'card_type': Number($('#select_card_type').val()),
                        	}]
                        }
                        rpc.query(params, {async: false}).fail(function(){
                        	self.pos.db.notification('danger',"Connection lost");
                        });
//                    	new Model("aspl.gift.card").get_func("create")({
//                    		'card_no': Number($('#card_no').val()),
//                    		'card_value':  Number($('#text_amount').val()),
//                    		'customer_id':self.partner_id ? Number(self.partner_id) : false,
//                    		'expire_date':$('#text_expire_date').val(),
//                    		'card_type': Number($('#select_card_type').val()),
//                    	});
                        self.gui.show_screen('receipt');
                        this.gui.close_popup();
                    }else{
                    	self.pos.db.notification('danger',_t('Please enter card value.'));
                        $('#text_amount').focus();
                    }
                }
            }else{
                self.pos.db.notification('danger',_t('Please select expire date.'));
                $('#text_expire_date').focus();
            }
            
        },

        renderElement: function() {
            var self = this;
            this._super();
            $('.datetime').datepicker({
            	minDate: 0,
            	dateFormat:'yy/mm/dd',
            });
        },
    });
    gui.define_popup({name:'create_card_popup', widget: CreateCardPopupWidget});

    var RedeemCardPopupWidget = PopupWidget.extend({
        template: 'RedeemCardPopupWidget',

        show: function(options){
           self = this;
           this.payment_self = options.payment_self || false;
           this._super();

           self.redeem = false;
           var order = self.pos.get_order();
           $('body').off('keypress', this.payment_self.keyboard_handler);
       	   $('body').off('keydown',this.payment_self.keyboard_keydown_handler);
           window.document.body.removeEventListener('keypress',self.payment_self.keyboard_handler);
           window.document.body.removeEventListener('keydown',self.payment_self.keyboard_keydown_handler);
           this.renderElement();
           $("#text_redeem_amount").keypress(function (e) {
               if(e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
               }
            });
           $('#text_gift_card_no').focus();
           $('#redeem_amount_row').hide();
           $('#text_gift_card_no').keypress(function(e) {
               if (e.which == 13 && $(this).val()) {
                    var today = moment().locale("en").format('YYYY-MM-DD');
                    var code = $(this).val();
                    var get_redeems = order.get_redeem_giftcard();
                    var existing_card = _.where(get_redeems, {'redeem_card': code });
                    var params = {
                    	model: 'aspl.gift.card',
                    	method: 'search_read',
                    	domain: [['card_no', '=', code], ['expire_date', '>=', today]],
                    }
                    rpc.query(params, {async: false})
//                    new Model('aspl.gift.card').get_func('search_read')([['card_no', '=', code], ['expire_date', '>=', today]])
                    .then(function(res){
                        if(res.length > 0){
                            if (res[0]){
                                if(existing_card.length > 0){
                                    res[0]['card_value'] = existing_card[existing_card.length - 1]['redeem_remaining']
                                }
                                self.redeem = res[0];
                                $('#lbl_card_no').html("Your Balance is  "+ self.format_currency(res[0].card_value));
                                if(res[0].customer_id[1]){
                                	$('#lbl_set_customer').html("Hello  "+ res[0].customer_id[1]);
                                } else{
                                	$('#lbl_set_customer').html("Hello  ");
                                }
                                $('#text_redeem_amount').show();
                                if(res[0].card_value <= 0){
                                    $('#redeem_amount_row').hide();
                                    $('#in_balance').show();
                                }else{
                                    $('#redeem_amount_row').fadeIn('fast');
                                    $('#text_redeem_amount').focus();
                                }
                            }
                        }else{
                        	self.pos.db.notification('danger',_t('Barcode not found or gift card has been expired.'));
                            $('#text_gift_card_no').focus();
                            $('#lbl_card_no').html('');
                            $('#lbl_set_customer').html('');
                            $('#in_balance').html('');
                            $('#text_redeem_amount').hide();
                        }
                    });
                }
            });
        },
  
        click_cancel: function(){
            var self = this;
            self._super();
            $('body').keypress(this.payment_self.keyboard_handler);
	        $('body').keydown(this.payment_self.keyboard_keydown_handler);
            window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
            window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
        },

        click_confirm: function(){
            var order = self.pos.get_order();
            var client = order.get_client();
            var redeem_amount = this.$('#text_redeem_amount').val();
            var code = $('#text_gift_card_no').val();
            if(self.redeem.card_no){
                if(code == self.redeem.card_no){
                    if(!self.redeem.card_value == 0){
                        if(redeem_amount){
                            if (redeem_amount <= (order.get_due() || order.get_total_with_tax())){
                                if(!client){
                                    order.set_client(self.pos.db.get_partner_by_id(self.redeem.customer_id[0]));
                                }
                                if( 0 < Number(redeem_amount)){
                                    if(self.redeem && self.redeem.card_value >= Number(redeem_amount) ){
                                        if(self.redeem.customer_id[0]){
                                        	var vals = {
                                                'redeem_card_no':self.redeem.id,
                                                'redeem_card':$('#text_gift_card_no').val(),
                                                'redeem_card_amount':$('#text_redeem_amount').val(),
                                                'redeem_remaining':self.redeem.card_value - $('#text_redeem_amount').val(),
                                                'card_customer_id': client ? client.id : self.redeem.customer_id[0],
                                                'customer_name': client ? client.name : self.redeem.customer_id[1],
                                            };
                                        } else {
                                        	var vals = {
                                                'redeem_card_no':self.redeem.id,
                                                'redeem_card':$('#text_gift_card_no').val(),
                                                'redeem_card_amount':$('#text_redeem_amount').val(),
                                                'redeem_remaining':self.redeem.card_value - $('#text_redeem_amount').val(),
                                                'card_customer_id': order.get_client() ? order.get_client().id : false,
                                                'customer_name': order.get_client() ? order.get_client().name : '',
                                            };
                                        }
                                    	
                                        var get_redeem = order.get_redeem_giftcard();
                                        if(get_redeem){
                                            var product = self.pos.db.get_product_by_id(self.pos.config.enable_journal_id)
                                            if(self.pos.config.enable_journal_id[0]){
                                               var cashregisters = null;
                                               for ( var j = 0; j < self.pos.cashregisters.length; j++ ) {
                                                    if(self.pos.cashregisters[j].journal_id[0] === self.pos.config.enable_journal_id[0]){
                                                        cashregisters = self.pos.cashregisters[j];
                                                    }
                                                }
                                            }
                                            if (vals){
                                            	$('body').keypress(self.payment_self.keyboard_handler);
                                    	        $('body').keydown(self.payment_self.keyboard_keydown_handler);
                                                window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
                                                window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
                                                if (cashregisters){
                                                    order.add_paymentline(cashregisters);
                                                    order.selected_paymentline.set_amount( Math.max(redeem_amount),0 );
                                                    order.selected_paymentline.set_giftcard_line_code(code);
                                                    order.selected_paymentline.set_freeze(true);
                                                    self.chrome.screens.payment.reset_input();
                                                    self.chrome.screens.payment.render_paymentlines();
                                                    order.set_redeem_giftcard(vals);
                                                } 
                                            }
                                            this.gui.close_popup();
                                        }
                                    }else{
                                        self.pos.db.notification('danger',_t('Please enter amount below card value.'));
                                        $('#text_redeem_amount').focus();
                                    }
                                }else{
                                    self.pos.db.notification('danger',_t('Please enter valid amount.'));
                                    $('#text_redeem_amount').focus();
                                }
                            }else{
                            	self.pos.db.notification('danger',_t('Card amount should be less than or equal to Order Due Amount.'));
                            } 
                            
                        }else{
                            self.pos.db.notification('danger',_t('Please enter amount.'));
                            $('#text_redeem_amount').focus();
                        }
                    }
                }else{
                    self.pos.db.notification('danger',_t('Please enter valid barcode.'));
                    $('#text_gift_card_no').focus();
                }
            }else{
//            	self.pos.db.notification('danger',_t('Press enter key.'));
                $('#text_gift_card_no').focus();
            }
        },
    });
    gui.define_popup({name:'redeem_card_popup', widget: RedeemCardPopupWidget});

    var RechargeCardPopupWidget = PopupWidget.extend({
        template: 'RechargeCardPopupWidget',

        show: function(options){
            self = this;
            this._super();
            self.pending_card = options.recharge_card_data;
            if(!self.pending_card){
            	this.card_no = options.card_no || "";
                this.card_id = options.card_id || "";
                this.card_value = options.card_value || 0 ;
                this.customer_id = options.customer_id || "";
            }
            this.renderElement();
            $('#text_recharge_amount').focus();
            $("#text_recharge_amount").keypress(function (e) {
                if(e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                	return false;
                }
            });
        },

        click_confirm: function(){
            var self = this;
            var order = self.pos.get_order();
            var client = order.get_client();
            var set_customer = $('#set_customers').val();
            if(!client){
                order.set_client(self.pos.db.get_partner_by_id(set_customer));
            }
            var recharge_amount = this.$('#text_recharge_amount').val();
            if (recharge_amount){
                if( 0 < Number(recharge_amount) ){
                    var vals = {
                    'recharge_card_id':self.card_id,
                    'recharge_card_no':self.card_no,
                    'recharge_card_amount':Number(recharge_amount),
                    'card_customer_id': self.customer_id[0] || false,
                    'customer_name': self.customer_id[1],
                    'total_card_amount':Number(recharge_amount)+self.card_value,
                    }
                    var get_recharge = order.get_recharge_giftcard();
                    if(get_recharge){
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (self.pos.config.gift_card_product_id[0]){
                            order.empty_cart();
                            var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            line.set_unit_price(recharge_amount);
                            order.add_orderline(line);
                            order.select_orderline(order.get_last_orderline());
                        }
                        if(self.pos.config.msg_before_card_pay){
                        	self.gui.show_popup('confirmation_card_payment',{'rechage_card_data':vals})
                        } else {
                        	order.set_recharge_giftcard(vals);
                            self.gui.show_screen('payment');
                            $("#card_back").hide();
                            $( "div.js_set_customer" ).off("click");
                            $( "div#card_invoice" ).off("click");
                            this.gui.close_popup();
                        }
                          
                    }
                }else{
                	self.pos.db.notification('danger',_t('Please enter valid amount.'));
                   $('#text_recharge_amount').focus();
                }
            }else{
            	self.pos.db.notification('danger',_t('Please enter amount.'));
                $('#text_recharge_amount').focus();
            }
        },
    });
    gui.define_popup({name:'recharge_card_popup', widget: RechargeCardPopupWidget});

    var EditCardPopupWidget = PopupWidget.extend({
        template: 'EditCardPopupWidget',

        show: function(options){
            self = this;
            this._super();
            this.card_no = options.card_no || "";
            this.card_id = options.card_id || "";
            this.expire_date = options.expire_date || "";
            this.renderElement();
            $('#new_expire_date').focus();
            $('#new_expire_date').keypress(function(e){
                if( e.which == 8 || e.keyCode == 46 ) return true;
                return false;
            });
        },

        click_confirm: function(){
            var self = this;
            var new_expire_date = this.$('#new_expire_date').val();
            if(new_expire_date){
                if(self.card_no){
                	var params = {
                		model: "aspl.gift.card",
                		method: "write",
                		args: [self.card_id,{'expire_date':new_expire_date}]
                	}
                	rpc.query(params, {async: false})
                    .then(function(res){
                    	if(res){
                    		self.pos.gui.chrome.screens.giftcardlistscreen.reloading_gift_cards();
                    	}
                    }).fail(function(){
                    	self.pos.db.notification('danger',"Connection lost");
                    });
                    this.gui.close_popup();
                }else{
                	self.pos.db.notification('danger',_t('Please enter valid card no.'));
                }
            }else{
            	self.pos.db.notification('danger',_t('Please select date.'));
                $('#new_expire_date').focus();
            }
        },

        renderElement: function() {
            var self = this;
            this._super();
            $('.date').datepicker({
            	minDate: 0,
            	dateFormat:'yy/mm/dd',
            });
            self.$(".emptybox_time").click(function(){ $('#new_expire_date').val('') });
        },
    });
    gui.define_popup({name:'edit_card_popup', widget: EditCardPopupWidget});

    var ExchangeCardPopupWidget = PopupWidget.extend({
        template: 'ExchangeCardPopupWidget',
        show: function(options){
            self = this;
            this._super();
            this.card_no = options.card_no || "";
            this.card_id = options.card_id || "";
            this.renderElement();
            $('#new_card_no').focus();
            var timestamp = new Date().getTime()/1000;
            if(self.pos.config.manual_card_number){
            	$('#new_card_no').removeAttr("readonly");
            	$("#new_card_no").keypress(function (e) {
                    if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                        return false;
                   }
                });
            } else{
            	$('#new_card_no').val(window.parseInt(timestamp));
            	$('#new_card_no').attr("readonly", "readonly");
            }
        },

        click_confirm: function(){
            var self = this;
            if(self.card_no){
	        	var card_number = $('#new_card_no').val();
	        	var move = true;
	        	if(!card_number){
	        		self.pos.db.notification('danger',_t('Enter gift card number.'));
	        		return;
	        	} else{
	        		var params = {
	        			model: 'aspl.gift.card',
	        			method: 'search_read',
	        			domain: [['card_no', '=', $('#new_card_no').val()]],
	        		}
	        		rpc.query(params, {async: false})
	                .then(function(gift_count){
	                	gift_count = gift_count.length
	                    if(gift_count > 0){
	                        $('#new_card_no').css('border', 'thin solid red');
	                        move = false;
	                    } else{
	                    	$('#new_card_no').css('border', '0px');
	                    }
	                }).fail(function(){
	                	self.pos.db.notification('danger',"Connection lost");
	                });
	        	}
	        	if(!move){
	        		self.pos.db.notification('danger',_t('Card already exist.'));
	        		return
	        	}
               var exchange_card_no = confirm("Are you sure you want to change card number?");
               if( exchange_card_no){
            	  var params = {
            		 model: "aspl.gift.card",
            		 method: "write",
            		 args: [[self.card_id],{'card_no':this.$('#new_card_no').val()}],
            	  }
            	  rpc.query(params, {async: false})
                  .then(function(res){
                	  if(res){
                		  self.pos.gui.chrome.screens.giftcardlistscreen.reloading_gift_cards();
                	  }
                  }).fail(function(){
                  	self.pos.db.notification('danger',"Connection lost");
                  });
                  this.gui.close_popup();
               }
            }
        },
    });

    gui.define_popup({name:'exchange_card_popup', widget: ExchangeCardPopupWidget});

    var ConfirmationCardPayment = PopupWidget.extend({
        template: 'ConfirmationCardPayment',

        show: function(options){
            self = this;
            this._super();
            self.options = options.card_data || false;
            self.recharge_card = options.rechage_card_data || false;
            self.renderElement();
        },
        click_confirm: function(){
            var self = this;
            var order = self.pos.get_order();
            if(self.recharge_card){
            	var vals = {
                    'recharge_card_id':self.recharge_card.recharge_card_id,
                    'recharge_card_no':self.recharge_card.recharge_card_no,
                    'recharge_card_amount':self.recharge_card.recharge_card_amount,
                    'card_customer_id': self.recharge_card.card_customer_id || false,
                    'customer_name': self.recharge_card.customer_name,
                    'total_card_amount':self.recharge_card.total_card_amount,
                }
            	order.set_recharge_giftcard(vals);
                self.gui.show_screen('payment');
            	$("#card_back").hide();
//                $("div.js_set_customer").off("click");
//                $("div#card_invoice").off("click");
            	$('.payment-buttons .control-button').off('click');
                this.gui.close_popup();
            } else if(self.options){
            	var gift_order = {'giftcard_card_no': self.options.giftcard_card_no,
                        'giftcard_customer': self.options.giftcard_customer ? Number(self.options.giftcard_customer) : false,
                        'giftcard_expire_date': self.options.giftcard_expire_date,
                        'giftcard_amount': self.options.giftcard_amount,
                        'giftcard_customer_name': self.options.giftcard_customer_name,
                        'card_type': self.options.card_type,
                }
                order.set_giftcard(gift_order);
                self.gui.show_screen('payment');
            	$("#card_back").hide();
//                $("div.js_set_customer").off("click");
//                $("div#card_invoice").off("click");
                $('.payment-buttons .control-button').off('click');
                this.gui.close_popup();
            }
        },
        click_cancel: function(){
        	var self = this;
        	if(self.recharge_card){
        		self.gui.show_popup('recharge_card_popup',{'recharge_card_data':self.recharge_card})
        	}else if(self.options){
        		self.gui.show_popup('create_card_popup',{'card_data':self.options});
        	}
        	
        }
    });

    gui.define_popup({name:'confirmation_card_payment', widget: ConfirmationCardPayment});

    var RedeemGiftVoucherPopup = PopupWidget.extend({
		template: 'RedeemGiftVoucherPopup',
		show: function(options){
            var self = this;
            this.payment_self = options.payment_self || false;
            this._super();
            var order = self.pos.get_order();
    		var total_pay = order.get_total_with_tax();
    		self.self_voucher = false ;
    		$('body').off('keypress', this.payment_self.keyboard_handler);
        	$('body').off('keydown',this.payment_self.keyboard_keydown_handler);
            window.document.body.removeEventListener('keypress',self.payment_self.keyboard_handler);
        	window.document.body.removeEventListener('keydown',self.payment_self.keyboard_keydown_handler);
            this.renderElement();
            $('#gift_voucher_text').focus();
            $('#gift_voucher_text').keypress(function(e) {
            	if (e.which == 13 && $(this).val()) {
            		var today = moment().locale("en").format('YYYY-MM-DD');
            		var code = $(this).val();
            		var params = {
            			model: 'aspl.gift.voucher',
            			method: 'search_read',
            			domain: [['voucher_code', '=', code], ['expiry_date', '>=', today]],
            		}
            		rpc.query(params, {async: false})
        			.then(function(res){
        				if(res.length > 0){
        					var due = order.get_total_with_tax() - order.get_total_paid();
	        				if (res[0].minimum_purchase <= total_pay && res[0].voucher_amount <= due){
		        					self.self_voucher = res[0]
		        					$('#barcode').html("Amount: "+ self.format_currency(res[0].voucher_amount))
		        			}else{
		        				self.pos.db.notification('danger',_t("Due amount should be equal or above to "+self.format_currency(res[0].minimum_purchase)));
		        			}
		        		}else{
		        			$('#barcode').html("")
		        			self.self_voucher = false ;	
		        			self.pos.db.notification('danger',_t("Voucher not found or voucher has been expired"));
		        		}
        			}).fail(function(){
                    	self.pos.db.notification('danger',"Connection lost");
                    });
	        	}
        	});
        },
    	click_confirm: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	var vouchers = order.get_voucher();
	    	var paymentlines = order.get_paymentlines();
	    	var cashregister = false;
	    	var code = $(gift_voucher_text).val();
	    	if (paymentlines.length > 0){
	    		self.chrome.screens.payment.click_delete_paymentline(paymentlines.cid)
	    	}
	    	if (self.self_voucher){
	    		var pid = Math.floor(Math.random() * 90000) + 10000;
	    		self.self_voucher['pid'] = pid
	    		if (self.pos.config.gift_voucher_journal_id.length > 0){
			        for ( var i = 0; i < self.pos.cashregisters.length; i++ ) {
			            if ( self.pos.cashregisters[i].journal_id[0] === self.pos.config.gift_voucher_journal_id[0] ){
			               cashregister = self.pos.cashregisters[i]
			            }
    				}
    				if (cashregister){
    					if(!vouchers){
    						self.check_redemption_customer().then(function(redeem_count){
								if (redeem_count == 0 || redeem_count < self.self_voucher.redemption_customer){
									order.add_paymentline(cashregister);
			    					order.selected_paymentline.set_amount( Math.max(self.self_voucher.voucher_amount, 0) );
								    order.selected_paymentline.set_gift_voucher_line_code(code);
								    order.selected_paymentline.set_pid(pid);
								    self.chrome.screens.payment.reset_input();
								    self.chrome.screens.payment.render_paymentlines();
								    order.set_voucher(self.self_voucher);
								    self.gui.close_popup();
								    $('body').keypress(self.payment_self.keyboard_handler);
							        $('body').keydown(self.payment_self.keyboard_keydown_handler);
								    window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
        							window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
								} else {
									self.pos.db.notification('danger',_t("Your voucher use's limit has been expired"));
								}
							});
						} else {
							if (self.self_voucher.voucher_code == code){
								var voucher_use = _.countBy(vouchers, 'voucher_code');
								if (voucher_use[code]){
									if(self.self_voucher.redemption_order > voucher_use[code]){
										self.check_redemption_customer().then(function(redeem_count){
                                            redeem_count += voucher_use[code];
											if (redeem_count == 0 || redeem_count < self.self_voucher.redemption_customer){
												order.add_paymentline(cashregister);
						    					order.selected_paymentline.set_amount( Math.max(self.self_voucher.voucher_amount, 0) );
						    					order.selected_paymentline.set_gift_voucher_line_code(code);
												order.selected_paymentline.set_pid(pid);
											    self.chrome.screens.payment.reset_input();
											    self.chrome.screens.payment.render_paymentlines();
											    order.set_voucher(self.self_voucher);
											    self.gui.close_popup();
											    $('body').keypress(self.payment_self.keyboard_handler);
										        $('body').keydown(self.payment_self.keyboard_keydown_handler);
											    window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
        										window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
											} else {
												self.pos.db.notification('danger',_t("Your voucher use's limit has been expired"));
											}
										});
									} else {
										self.pos.db.notification('danger',_t("Voucher limit has been expired for this order"));
										$('#barcode').html("")
										$('#gift_voucher_text').focus();
									}
								} else {
	                                self.check_redemption_customer().then(function(redeem_count){
										if (redeem_count == 0 || redeem_count < self.self_voucher.redemption_customer){
										    self.self_voucher['already_redeemed'] = redeem_count;
											order.add_paymentline(cashregister);
					    					order.selected_paymentline.set_amount(Math.max(self.self_voucher.voucher_amount, 0) );
										    order.selected_paymentline.set_gift_voucher_line_code(code);
										    order.selected_paymentline.set_pid(pid);
										    self.chrome.screens.payment.reset_input();
										    self.chrome.screens.payment.render_paymentlines();
										    order.set_voucher(self.self_voucher);
											self.gui.close_popup();
											$('body').keypress(self.payment_self.keyboard_handler);
									        $('body').keydown(self.payment_self.keyboard_keydown_handler);
											window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
        									window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
										} else {
											self.pos.db.notification('danger',_t("Your voucher use's limit has been expired"));
										}
									});
								}
							} else {
								self.pos.db.notification('danger',_t("Voucher barcode is invalid"));
							}
						}
					} 
				} else {
					self.pos.db.notification('danger',_t("Please set Journal for gift voucher in POS Configuration"));
				}
			} else {
//				self.pos.db.notification('danger',_t("Press enter to get voucher amount"));
				$('#gift_voucher_text').focus();
			}
		},
        click_cancel: function(){
        	var self = this;
        	self._super()
        	$('body').keypress(self.payment_self.keyboard_handler);
	        $('body').keydown(self.payment_self.keyboard_keydown_handler);
        	window.document.body.addEventListener('keypress',self.payment_self.keyboard_handler);
        	window.document.body.addEventListener('keydown',self.payment_self.keyboard_keydown_handler);
        },
        check_redemption_customer: function(){
        	var self = this;
        	var order = self.pos.get_order();
        	var domain = [['voucher_id', '=', self.self_voucher.id]];
        	if(order.get_client()){
        		domain.push(['customer_id', '=', order.get_client().id])
        	}
        	var params = {
        		model: 'aspl.gift.voucher.redeem',
        		method: 'search_count',
        		args: [domain],
        	}
        	return rpc.query(params, {async: false}).fail(function(){
            	self.pos.db.notification('danger',"Connection lost");
            });
    	}
	});
	gui.define_popup({name:'redeem_gift_voucher_popup', widget: RedeemGiftVoucherPopup});

	var LockPopupWidget = PopupWidget.extend({
	    template:'LockPopupWidget',
	    show: function(options){
	    	var self = this;
	        this._super(options);
	        this.$('.close-lock-btn').click(function(){
	        	self.gui.close_popup();
	        });
	        this.$('.lock-pos').click(function(){
	        	self.gui.close_popup();
	        	var current_screen = self.pos.gui.get_current_screen();
            	var user = self.pos.get_cashier();
                self.pos.set_locked_user(user.login);
                if(current_screen){
                	self.pos.set_locked_screen(current_screen);
                }
            	var params = {
    	    		model: 'pos.session',
    	    		method: 'write',
    	    		args: [self.pos.pos_session.id,{'is_lock_screen' : true}],
    	    	}
    	    	rpc.query(params, {async: false}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
                $('.lock_button').css('background-color', 'rgb(233, 88, 95)');
                $('.freeze_screen').addClass("active_state");
                $(".unlock_button").fadeIn(2000);
                $('.unlock_button').show();
                $('.unlock_button').css('z-index',10000);
	        });
	    },
	});
	gui.define_popup({name:'lock_popup', widget: LockPopupWidget});
	
	var TerminalListPopup = PopupWidget.extend({
	    template: 'TerminalListPopup',
	    start: function(){
	    	var self = this;
	    	this._super();
	    },
	    show: function(options){
	        var self = this;
	    	options = options || {};
	        this._super(options);
	        this.session_list = options.sessions;
	        var message = "";
	        self.render_list(self.session_list);
	        var prev_id = "";
	        var flag_broad_cast = false;
	        self.popup_design();
	        $('.terminal-list-contents').delegate('#toggle_session','click',function(event){
	        	var session_id = parseInt($(this).data('id'));
        		var session = self.pos.session_by_id[session_id];
	        	if(session){
        			var status = false;
        			if(session.locked){
        				status = false;
        				session['locked'] = false;
        			} else{
        				status = true;
	    	    		session['locked'] = true;
        			}
    				var params = {
	    	    		model: 'lock.data',
	    	    		method: 'lock_session_log',
	    	    		args: [session_id,session.current_cashier_id[0],self.pos.get_cashier(),status],
	    	    	}
	    	    	rpc.query(params, {async: false}).then(function(result){
	    	    		if(result && result[0]){
	    	    			for(var i = self.session_list.length - 1; i >= 0; i--) {
							    if(self.session_list[i].id == result[0].id) {
							    	self.session_list[i].locked_by_user_id = result[0].locked_by_user_id;
							    }
							}
	    	    		}else{
    	    	    		session['locked'] = true;
	    	    			self.pos.db.notification('danger',"This operation is done by another user.");
	    	    		}
	    	    		self.render_list(self.session_list);
	    	    	}).fail(function(){
	                	self.pos.db.notification('danger',"Connection lost");
	                });
        		}
            });
	        $('.terminal-list-contents').delegate('.line_message_btn','click',function(event){
	        	self.popup_design('with_chat');
	        	self.line_session_id = parseInt($(this).data('id'));
	        	$('#session_message_txtarea').val("");
	        	$('.line_message_btn').css('color','#5EB937');
	        	$(this).css('color','#7f82ac')
	        	flag_broad_cast = false;
	        	if(self.line_session_id == prev_id){
	        		self.popup_design();
	        		prev_id = "";
	        		$('.line_message_btn').css('color','#5EB937');
	        	} else{
	        		prev_id = self.line_session_id;
	        	}
	        	var session = self.pos.session_by_id[self.line_session_id];
	        	$('#session_message_txtarea').focus();
	        	if(self.pos.pos_session.current_cashier_id){
	        		$('#to_send_user_name').text(session.current_cashier_id[1])
	        	} else{
	        		$('#to_send_user_name').text(session.user_id[1])
	        	}
	        });
	    	$('#message_area_container').delegate('#session_message_txtarea','keypress',function(e){
	    		message = "";
	    		if(e.keyCode == 13){
		        	message = $('#session_message_txtarea').val();
		        	message = message.trim()
	        		var session_id = self.line_session_id;
		        	var session = self.pos.session_by_id[session_id];
		        	if(flag_broad_cast){
		        		var params = {
    	    	    		model: 'message.terminal',
    	    	    		method: 'broadcast_message_log',
    	    	    		args:[self.session_list,self.pos.get_cashier().id,message]
    	    	    	}
    	    	    	rpc.query(params, {async: false}).then(function(result){
    	    	    		if(result){
    	    	    			$('#session_message_txtarea').val("");
    	    	    		}
    	    	    	}).fail(function(){
    	                	self.pos.db.notification('danger',"Connection lost");
    	                });
		        	}else{
		        		if(session && message){
		        			var params = {
	    	    	    		model: 'message.terminal',
	    	    	    		method: 'create',
	    	    	    		args:[{'message_session_id':session_id,
		    	    			'receiver_user':session.current_cashier_id[0],
		    	    			'sender_user':self.pos.get_cashier().id,
		    	    			'message':message}]
	    	    	    	}
	    	    	    	rpc.query(params, {async: false}).then(function(result){
	    	    	    		if(result){
	    	    	    			$('#session_message_txtarea').val("");
	    	    	    		}
	    	    	    	}).fail(function(){
	    	                	self.pos.db.notification('danger',"Connection lost");
	    	                });
		        		}
		        	}
	        	}
	        });
	        $('.close_terminal_list').click(function(){
	        	self.gui.close_popup();
	        });
	        $('.broadcast_message').click(function(){
	        	self.popup_design("with_chat")
	        	$('#session_message_txtarea').val("");
	        	$('.line_message_btn').css('color','#5EB937');
	        	$('#to_send_user_name').text("Broadcast");
	        	prev_id = "";
	        	flag_broad_cast = true;
	        });
	    },
	    popup_design: function(design){
	    	if(design == 'with_chat'){
	    		$("#message_area_container").show();
	    		$('#popup_design_change').removeClass('popup_without_chat');
		        $('#sessionlist_container').removeClass('session_list_without_chat');
		        $('#popup_design_change').addClass('popup_with_chat');
	        	$('#sessionlist_container').addClass('session_list_with_chat');
	    	} else{
	    		$("#message_area_container").hide();
	    		$('#popup_design_change').removeClass('popup_with_chat');
		        $('#sessionlist_container').removeClass('session_list_with_chat');
		        $('#popup_design_change').addClass('popup_without_chat');
		        $('#sessionlist_container').addClass('session_list_without_chat');
		        $("#message_area_container").css('display','none !important');
	    	}
	    },
	    click_confirm: function(){
	    	var self = this;
	        if(self.session_list && self.session_list[0]){
	        	var params = {
    	    		model: 'lock.data',
    	    		method: 'lock_unlock_all_session',
    	    		args: [self.session_list,self.pos.get_cashier(),true],
    	    	}
    	    	rpc.query(params, {async: false}).then(function(result){
    	    		if(result){
    	    			self.session_list = result;
    	    			_.each(self.session_list,function(session){
    	    				self.pos.session_by_id[session.id] = session;
    	    			});
    	    		}
    	    	}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
	        	self.render_list(self.session_list);
	        }
	    },
	    click_cancel: function(){
	    	var self = this;
	        if(self.session_list && self.session_list[0]){
	        	var params = {
    	    		model: 'lock.data',
    	    		method: 'lock_unlock_all_session',
    	    		args: [self.session_list,self.pos.get_cashier(),false],
    	    	}
    	    	rpc.query(params, {async: false}).then(function(result){
    	    		if(result){
    	    			self.session_list = result;
    	    			_.each(self.session_list,function(session){
    	    				self.pos.session_by_id[session.id] = session;
    	    			});
    	    		}
    	    	}).fail(function(){
                	self.pos.db.notification('danger',"Connection lost");
                });
				self.render_list(self.session_list);
	        }
	    },
	    render_list: function(session_list){
	    	var self = this;
	        var contents = this.$el[0].querySelector('.terminal-list-contents');
	        contents.innerHTML = "";
	        for(var i=0;i<session_list.length;i++){
	            var session = session_list[i];
                var sessionline_html = QWeb.render('SessionLine',{widget: this, session:session_list[i]});
                var sessionline = document.createElement('tbody');
                sessionline.innerHTML = sessionline_html;
                sessionline = sessionline.childNodes[1];
	            contents.appendChild(sessionline);
	        }
	    },
	});
	gui.define_popup({name:'terminal_list', widget: TerminalListPopup});

	var ProductQtyAdvancePopupWidget = PopupWidget.extend({
	    template: 'ProductQtyAdvancePopupWidget',
	    show: function(options){
	        options = options || {};
	        this.prod_info_data = options.prod_info_data || false;
	        this.total_qty = options.total_qty || '';
	        this.product = options.product || false;
	        this._super(options);
	        this.renderElement();
	    },
	    renderElement: function(){
	    	var self = this;
	    	this._super();
	    	$(".input_qty").keyup(function(e){
	    		if($.isNumeric($(this).val()) || e.key == "Backspace"){
	    			var remaining_qty = $(this).attr('loaction-data');
	    			var qty = Number($(this).val());
	    			if(qty > 10){
	    				self.pos.db.notification('danger',_t('Can not add more than remaining quantity.'));
	    				$(this).val(0);
	    			}
	    		} else {
	    			$(this).val(0);
	    		}
	    	});
	    },
	    click_confirm: function(){
	    	var self = this;
            var order = self.pos.get_order();
	        for(var i in this.prod_info_data){
	        	var loc_id = this.prod_info_data[i][2]
	        	if($("#"+loc_id).val() && Number($("#"+loc_id).val()) > 0){
					order.add_product(this.product,{quantity:$("#"+loc_id).val(),force_allow:true})
					order.get_selected_orderline().set_location_id(this.prod_info_data[i][2]);
					order.get_selected_orderline().set_location_name(this.prod_info_data[i][0]);
	        	}
	        }
	        this.gui.close_popup();
	    },
	});
	gui.define_popup({name:'product_qty_advance_popup', widget: ProductQtyAdvancePopupWidget});

	var AddToWalletPopup = PopupWidget.extend({
	    template: 'AddToWalletPopup',
	    show: function(options){
	    	var self = this;
	    	var order = self.pos.get_order();
	        options = options || {};
	        this.change = order.get_change() || false;
	        this._super(options);
	        this.renderElement();
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	if(!self.pos.config.cash_control){
	    		self.pos.db.notification('danger',_t("Please enable cash control from point of sale settings."));
	    	}
	    	if(order.get_client()){
	    		order.set_type_for_wallet('change');
	    		order.set_change_amount_for_wallet(order.get_change());
	    		this.validate();
	    	} else {
	    		if(confirm("To add money into wallet you have to select a customer or create a new customer \n Press OK for go to customer screen \n Press Cancel to Discard.")){
	    			self.gui.show_screen('clientlist');
	    		}else{
	    			this.gui.close_popup();
	    		}
	    	}
	    },
	    click_cancel: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	self.validate();
	        this.gui.close_popup();
	    },
	    validate: function(){
	    	var self = this;
	    	var order = self.pos.get_order();
	    	var currentOrder = order;
	    	self.pos.push_order(order).then(function(){
        		setTimeout(function(){
        			self.gui.show_screen('receipt');
        		},1000)
        	});
	        this.gui.close_popup();
	    }
	});
	gui.define_popup({name:'AddToWalletPopup', widget: AddToWalletPopup});
	
	//Reservation
	/* Delivery Date POPUP */
	var DeliveryDatePopup = PopupWidget.extend({
	    template: 'DeliveryDatePopup',
	    show: function(options){
	    	var self = this;
			this._super();
		    var options = options || {}
		    if(options){
		        this.payment_obj = options.payment_obj;
		        this.new_date = options.new_date;
		        this.to_be_update_order = options.order;
		        this.draft = options.draft;
		    }
		    var order = this.pos.get_order();
			self.renderElement();
			if(order.get_reserve_delivery_date()){
		        $('#delivery_datepicker').val(order.get_reserve_delivery_date());
		    }
		    $('#delivery_datepicker').focus();
	    },
	    click_confirm: function(){
	        var self = this;
            var order = this.pos.get_order();
            order.set_reserve_delivery_date($('#delivery_datepicker').val() || false);
            if(this.new_date){
                if(!this.draft && this.payment_obj){
                    if(order.get_total_paid() != 0){
                        if(!order.get_reservation_mode()){
                            order.set_partial_pay(true);
                        }
                        self.payment_obj.finalize_validation();
                        $('.js_reservation_mode').removeClass('highlight');
                    } else{
                    	if(self.pos.config.allow_reservation_with_no_amount && self.pos.config.enable_order_reservation){
                    		self.payment_obj.finalize_validation();
                    		$('.js_reservation_mode').removeClass('highlight');
                    	}
                    }
				} else if(this.draft){
				    this.pos.push_order(order);
				    this.gui.show_screen('receipt');
				}
            }else {
                if(order && self.to_be_update_order.reserve_delivery_date != $('#delivery_datepicker').val()){
                	var params = {
                		model: 'pos.order',
                		method: 'update_delivery_date',
                		args: [self.to_be_update_order.id, $('#delivery_datepicker').val()]
                	}
                	rpc.query(params, {async: false})
		            .then(function(res){
		                self.pos.db.add_orders(res);
		                var temp_orders = self.pos.get('pos_order_list');
		                $.extend(temp_orders, res);
		                self.pos.set({ 'pos_order_list' : temp_orders });
		            });
        	    }
        	}
			this.gui.close_popup();
	    },
        renderElement: function(){
            var self = this;
            this._super();
            $('#delivery_datepicker').datepicker({
               dateFormat: 'yy-mm-dd',
               minDate: new Date(),
               closeText: 'Clear',
               showButtonPanel: true,
            }).focus(function(){
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                });
            });
            $('#delivery_datepicker').datepicker('setDate', new Date());
        },
	});
	gui.define_popup({name:'delivery_date_popup', widget: DeliveryDatePopup});

	var CancelOrderPopup = PopupWidget.extend({
	    template: 'CancelOrderPopup',
	    init: function(parent, args) {
	    	var self = this;
	        this._super(parent, args);
	        this.options = {};
	        this.line = [];
	        this.select_all = function(e){
                $('.ac_selected_product').prop('checked', $('.check_all_items_checkbox').prop('checked'));
                var contents = self.$el[0].querySelector('div.product_info ul');
                $(contents).empty();
                $('.ac_selected_product').trigger('change');
	        }
	        this.update_qty = function(ev){
	        	ev.preventDefault();
	            var $link = $(ev.currentTarget);
                self._update_qty($link);
	            return false;
	        };
	        this.keydown_qty = function(e){
	        	if($(this).val() > $(this).data('max')){
	        		$(this).val($(this).data('max'))
	        	}
	        	if($(this).val() < $(this).data('min')){
	        		$(this).val($(this).data('min'))
	        	}
	        	if (/\D/g.test(this.value)){
                    // Filter non-digits from input value.
                    this.value = this.value.replace(/\D/g, '');
                }
                self.update_line(self.generate_line($(this).attr('name')));
	        };
	    },
	    _update_qty: function($link){
	        var self = this;
	        var $input = $link.parent().parent().find("input");
            var min = parseFloat($input.data("min") || 0);
            var max = parseFloat($input.data("max") || Infinity);
            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(),10);
            $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
            $('input[name="'+$input.attr("name")+'"]').val(quantity > min ? (quantity < max ? quantity : max) : min);
            $input.change();
            self.update_line(self.generate_line($($input).attr('name')));
	    },
	    show: function(options){
	    	var self = this;
	        options = options || {};
	        this._super(options);
	        this.order_tobe_cancel = options.order;
	        if (this.order_tobe_cancel){
	        	var params = {
	        		model: 'pos.order.line',
	        		method: 'search_read',
	        		domain: [['id', 'in', this.order_tobe_cancel.lines], ['qty', '>', 0]]
	        	}
	        	rpc.query(params, {async: false})
                .then(function(lines){
                    _.each(lines, function(line){
                        self.line[line.id] = line
                    });
                    self.lines = lines;
                });
	        }
	        this.renderElement();
	        self.update_summary();
	    },
	    update_line: function(line){
	        var self = this;
	        var contents = this.$el[0].querySelector('div.product_info ul');
            var li = $(contents).find('li[data-id="'+ line.id +'"]')
	        if(li.length){
	            var new_line = self.rerender_line(line);
	            $(li).replaceWith(new_line);
	            self.update_summary()
	        }
	    },
	    rerender_line: function(line){
	        var self = this;
	        var el_str  = QWeb.render('CancelLines',{widget:this, line:line});
            var el_ul = document.createElement('ul');
            el_ul.innerHTML = el_str;
            el_ul = el_ul.childNodes[1];
            el_ul.querySelector('.remove_line').addEventListener('click', function(e){
                $('.ac_selected_product[data-name="'+ line.id +'"]').prop('checked', false);
                self.render_lines(line, "remove");
                if(!$('.ac_selected_product:checked').length){
                    $('.check_all_items_checkbox').prop('checked', false);
                }
            });

            return el_ul;
	    },
	    render_lines: function(line, operation){
            var self = this;
            var contents = this.$el[0].querySelector('div.product_info ul');
            if(operation == "remove"){
                $(contents).find('li[data-id="'+ line.id +'"]').remove();
                self.update_summary()
                return
            }
            var el_ul = self.rerender_line(line);
            contents.appendChild(el_ul);
            self.update_summary()
            var line_count = $(contents).find('ul li').length;
            this.el.querySelector('.product_info').scrollTop = 100 * line_count;
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var selectedOrder = this.pos.get_order();
	    	this.total = 0.00;
	    	this.remaining_item_total = 0.00;
	    	var temp_orderline_ids = [];
            _.each($('.ac_selected_product:checked'), function(item){
                var orderline = self.line[$(item).data('name')];
                temp_orderline_ids.push($(item).data('name'));
                var product = self.pos.db.get_product_by_id(orderline.product_id[0]);
                var qty = $('input[name="'+orderline.id+'"').val();
                selectedOrder.add_product(product, {quantity: qty * -1, price: 0.00 });
                if(selectedOrder.get_selected_orderline()){
                    selectedOrder.get_selected_orderline().set_cancel_process(orderline.order_id);
                    selectedOrder.get_selected_orderline().set_cancel_item(true);
                    selectedOrder.get_selected_orderline().set_cancel_item_id(orderline.id);
                    if((orderline.qty - qty) <= 0){
                        selectedOrder.get_selected_orderline().set_line_status("full");
                    } else {
                        selectedOrder.get_selected_orderline().set_line_status("partial");
                    }
                    if(product.type != "service"){
                        selectedOrder.get_selected_orderline().set_consider_qty(orderline.qty - qty);
                    }
                }
                self.total += orderline.price_unit * qty;
            });
            if(temp_orderline_ids.length > 0){
                _.each(self.lines, function(line){
                    if($.inArray(line.id, temp_orderline_ids) == -1){
                        self.remaining_item_total += line.price_subtotal_incl;
                    }
                })
                self.add_charge_product();
                if(self.new_amount_due < 0){
                    self.add_refund_product();
                } else {
                    self.add_paid_amount();
                }
                if (this.order_tobe_cancel.partner_id && this.order_tobe_cancel.partner_id[0]) {
                    var partner = self.pos.db.get_partner_by_id(this.order_tobe_cancel.partner_id[0])
                    selectedOrder.set_client(partner);
                }
                selectedOrder.set_reservation_mode(true);
                selectedOrder.set_pos_reference(this.order_tobe_cancel.pos_reference);
                selectedOrder.set_sequence(this.order_tobe_cancel.name);
                selectedOrder.set_cancel_order(true);
                selectedOrder.set_order_id(this.order_tobe_cancel.id);
                selectedOrder.set_reserve_delivery_date(this.order_tobe_cancel.reserve_delivery_date);
                selectedOrder.set_amount_paid(this.order_tobe_cancel.amount_paid);
                selectedOrder.set_cancellation_charges(self.cancel_charge);
                selectedOrder.set_refund_amount(self.refundable_total);
                if(self.refundable_total > 0){
                    selectedOrder.set_reservation_mode(false);
                }
                self.pos.gui.show_screen('payment');
                this.gui.close_popup();
            }
	    },
	    get_product_image_url: function(product_id){
    		return window.location.origin + '/web/binary/image?model=product.product&field=image_medium&id='+product_id;
    	},
    	generate_line: function(line_id){
    	    var self = this;
            var selected_line = self.line[line_id]
            var qty = $('.js_quantity[name="'+ line_id +'"]').val();
            var line = false
            if(selected_line){
                var line = {
                    product_name: selected_line.display_name,
                    price: qty*selected_line.price_unit,
                    qty: self.get_qty_str(selected_line.product_id[0], qty) || 0.00,
                    id: selected_line.id,
                }
                return line
            }
            return false
    	},
    	get_qty_str: function(product_id, qty){
            var self = this;
            var qty;
            var product = self.pos.db.get_product_by_id(product_id);
            if(product){
                var unit = self.pos.units_by_id[product.uom_id[0]]
                var new_qty = '';
                if(unit){
                    qty    = round_pr(qty, unit.rounding);
                    var decimals = self.pos.dp['Product Unit of Measure'];
                    
                    new_qty = field_utils.format.float(round_di(qty, decimals), {digits: [69, decimals]});
                    return new_qty + '/' + unit.display_name
                }
            }
        },
    	renderElement: function(){
    	    var self = this;
            this._super();
            this.$('.input-group-addon').delegate('a.js_qty','click', this.update_qty);
            this.$('div.input-group').delegate('.js_quantity','input', this.keydown_qty);
            $('.ac_selected_product').change(function(){
                var line_id = $(this).data('name');
                var line = self.generate_line(line_id)
                if(line){
                    if($(this).prop('checked')){
                        self.render_lines(line);
                        if($('.ac_selected_product:checked').length === $('.ac_selected_product').length){
                            $('.check_all_items_checkbox').prop('checked', true);
                        }
                    } else {
                        self.render_lines(line, "remove");
                        $('.check_all_items_checkbox').prop('checked', false);
                    }
                }
            })
            this.$('.check_all_items').delegate('.label', 'click', function(e){
                $('.check_all_items_checkbox').prop('checked', !$('.check_all_items_checkbox').prop('checked'));
                self.select_all(e);
            });
            this.$('.check_all_items').delegate('.check_all_items_checkbox', 'click', this.select_all);
    	},
    	get_total: function(){
    	    var self = this;
    	    var total = 0.00;
    	    var temp_orderline_ids = [];
    	    _.each($('.ac_selected_product:checked'), function(item){
                var orderline = self.line[$(item).data('name')];
                temp_orderline_ids.push($(item).data('name'));
                var qty = $('input[name="'+orderline.id+'"').val();
                total += orderline.price_unit * qty;
            });
            return total;
    	},
    	update_summary: function(){
    	    var self = this;
            self.cancel_charge = self._calculate_cancellation_charges();
            self.refundable_total = self._calculate_refund_amount() ? self._calculate_refund_amount() + self.cancel_charge : self._calculate_refund_amount();
            var cancel_order_total = self.get_total();
            var new_order_total = self.order_tobe_cancel.amount_total - cancel_order_total + self.cancel_charge;
            self.new_amount_due = new_order_total - self.order_tobe_cancel.amount_paid;
            this.el.querySelector('.cancel_order_summary .cancel_order_total > .value').textContent = this.format_currency(cancel_order_total);
            this.el.querySelector('.cancel_order_summary .new_order_total > .value').textContent = this.format_currency(new_order_total);
            this.el.querySelector('.cancel_order_summary .new_amount_due > .value').textContent = this.format_currency(self.new_amount_due > 0 ? self.new_amount_due : 0.00);
    	    this.el.querySelector('.cancel_order_summary .refundable_total > .value').textContent = this.format_currency(Math.abs(self.refundable_total));
    	    this.el.querySelector('.cancel_order_summary .cancel_charge > .value').textContent = this.format_currency(self.cancel_charge);
    	},
    	_calculate_cancellation_charges: function(){
    	    var self = this;
    	    var price = 0.00;
    	    if(self.pos.config.cancellation_charges_type == "percentage"){
                price = (self.get_total() * self.pos.config.cancellation_charges) / 100;
            } else {
                price = self.pos.config.cancellation_charges;
            }
            return price
    	},
    	add_charge_product: function(){
    	    var self = this;
    	    var selectedOrder = self.pos.get_order();
    	    var price = self._calculate_cancellation_charges();
    	    if(self.pos.config.cancellation_charges_product_id){
                var cancel_product = self.pos.db.get_product_by_id(self.pos.config.cancellation_charges_product_id[0]);
                if(cancel_product){
                    selectedOrder.add_product(cancel_product, {quantity: 1, price: price });
                    selectedOrder.get_selected_orderline().set_cancel_item(true);
                } else {
                	self.pos.db.notification('danger',_t("Cannot Find Cancellation Product"));
                }
            } else {
            	self.pos.db.notification('danger',_t("Please configure Cancellation product from Point of Sale Configuration"));
            }
    	},
    	_calculate_refund_amount: function(){
    	    var self = this;
    	    var current_order_total = self.order_tobe_cancel.amount_total - self.get_total();
    	    var customer_paid = (self.order_tobe_cancel.amount_total - self.order_tobe_cancel.amount_due);
            var final_amount = 0.00
            if(current_order_total < customer_paid){
                final_amount = current_order_total - customer_paid;
            }
            return final_amount;
    	},
    	add_refund_product: function(){
    	    var self = this;
    	    var selectedOrder = self.pos.get_order();
    	    var price = self._calculate_refund_amount();
    	    if(self.pos.config.refund_amount_product_id){
                var refund_product = self.pos.db.get_product_by_id(self.pos.config.refund_amount_product_id[0]);
                if(refund_product){
                    selectedOrder.add_product(refund_product, {quantity: 1, price: price });
                } else {
                    self.pos.db.notification('danger',_t("Cannot Find Refund Product"));
                }
            } else {
            	self.pos.db.notification('danger',_t("Please configure Refund product from Point of Sale Configuration"));
            }
    	},
    	add_paid_amount: function(){
    	    var self = this;
    	    var selectedOrder = self.pos.get_order();
    	    if(self.pos.config.prod_for_payment){
    	        var paid_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                if(paid_product){
                    selectedOrder.add_product(paid_product, {quantity: 1, price: self.new_amount_due - self._calculate_cancellation_charges() });
                } else {
                	self.pos.db.notification('danger',_t("Cannot Find Refund Product"));
                }
    	    } else {
    	    	self.pos.db.notification('danger',_t("Please configure Refund product from Point of Sale Configuration"));
            }
    	},
	});
	gui.define_popup({name:'cancel_order_popup', widget: CancelOrderPopup});

    var MaxCreditExceedPopupWidget = PopupWidget.extend({
	    template: 'MaxCreditExceedPopupWidget',
	    show: function(options){
	        var self = this;
	        this._super(options);
	    },
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .button.override_payment':  'click_override_payment',
        }),
        click_override_payment: function(){
        	var self = this;
        	var currentOrder = this.pos.get_order();
        	if(currentOrder.get_reservation_mode() && !currentOrder.get_reserve_delivery_date()){
                this.gui.close_popup();
                self.gui.show_popup("delivery_date_popup", {
                    'payment_obj': self.options.payment_obj,
                    'new_date': true,
                    'draft': self.options.draft_order,
                });
                return
            }
        	if(self.options.payment_obj){
        	    if(!currentOrder.get_paying_due() && !currentOrder.get_cancel_order()){
            		currentOrder.set_fresh_order(true);
            	}
                if(currentOrder.get_total_paid() != 0){
                    this.options.payment_obj.finalize_validation();
                    this.gui.close_popup();
                }
                $('.js_reservation_mode').removeClass('highlight');
            } else if(self.options.draft_order){
            	this.pos.push_order(this.pos.get_order());
            	self.gui.show_screen('receipt');
            	this.gui.close_popup();
            }
        },
	});
	gui.define_popup({name:'max_limit', widget: MaxCreditExceedPopupWidget});

//	Cash In/Out Popup and Statement Popup

	var PrintCashInOutStatmentPopup = PopupWidget.extend({
        template: 'PrintCashInOutStatmentPopup',
        show: function(){
            var self = this;
            var users = self.pos.users;
            this._super();
			this.renderElement();
			var order = self.pos.get_order();
			this.$('.button.ok').click(function() {
			    var start_date = $('.start-date input').val() + ' 00:00:00';
			    var end_date = $('.end-date input').val() + ' 23:59:59';
			    var user_id = $('#user-id').find(":selected").text();
			    var domain = [];
			    order.set_statement_cashier(user_id);
                if(user_id){
                    if($('.start-date input').val() && $('.end-date input').val()){
                        domain = [['create_date', '>=', start_date],['create_date', '<=', end_date],['user_id', '=', Number($('#user-id').val())]];
                    }
                    else if($('.start-date input').val()){
                        domain = [['create_date', '>=', start_date],['user_id', '=', Number($('#user-id').val())]];
                    }
                    else if($('.end-date input').val()){
                        domain = [['create_date', '<=', end_date],['user_id', '=', Number($('#user-id').val())]];
                    }else{
                        domain = [['user_id', '=', Number($('#user-id').val())]];
                    }
                }else{
                    if($('.start-date input').val() && $('.end-date input').val()){
                        domain = [['create_date', '>=', start_date],['create_date', '<=', end_date]];
                    }
                    else if($('.start-date input').val()){
                        domain = [['create_date', '>=', start_date]];
                    }
                    else if($('.end-date input').val()){
                        domain = [['create_date', '<=', end_date]];
                    }else{
                        domain = [];
                    }
                }
                var params = {
                    model: 'cash.in.out.history',
                    method: 'search_read',
                    domain: domain,
                }
                rpc.query(params, {async: false}
                ).then(function(result){
                    var order = self.pos.get_order();
                    if(user_id && result){
                        order.set_cash_register(result);
                        if(start_date && end_date){
                            if(result.length > 0){
                                self.gui.show_screen('receipt');
                            }
                        }
                    }else{
                        var data = {};
                        users.map(function(user){
                            var new_records = [];
                            result.map(function(record){
                                if(record.user_id[0] == user.id){
                                    new_records.push(record)
                                }
                            });
                            data[user.id] = new_records;
                        });
                        var flag = false;
                        for (var key in data) {
                            if(data[key].length > 0){
                                flag = true;
                            }
                        }
                        if(flag){
                            order.set_cash_register(data);
                            self.gui.show_screen('receipt');
                        }
                    }
                });
			});
			this.$('.button.cancel').click(function() {
				self.gui.close_popup();
			});
        },
    });
    gui.define_popup({name:'cash_inout_statement_popup', widget: PrintCashInOutStatmentPopup});

    var CashOperationPopup = PopupWidget.extend({
        template: 'CashOperationPopup',
        show: function(options){
            this._super(options);
            $('.reason').focus();
        },
        click_confirm: function(){
            var self = this;
            var name = $('.reason').val() || false;
            var amount = $('.amount').val() || false;
            if(name =='' || amount == ''){
                self.pos.db.notification('danger',_t("Please fill all fields."));
                $('.reason').focus();
            }else if(!$.isNumeric(amount)){
            	self.pos.db.notification('danger',_t("Please input valid amount."));
                $('.amount').val('').focus();
            }else{
                var session_id = '';
                var vals = {
                    'session_id': self.pos.pos_session.id,
                    'name': name,
                    'amount': amount,
                    'operation': self.options.operation,
                    'cashier': self.pos.get_cashier().id,
                }
                var params = {
                    model: 'pos.session',
                    method: 'cash_in_out_operation',
                    args: [vals],
                }
                rpc.query(params, {async: false})
                .then(function(result) {
                    if (result['error']) {
                        self.gui.show_popup('error',{
                            'title': _t('Cash Control Configuration'),
                            'body': _t('Please enable cash control for this session.'),
                        });
                    }else {
                        var order = self.pos.get_order();
                        var operation = self.options.operation == "take_money" ? 'Take Money Out' : 'Put Money In'
                        if(order && self.pos.config.money_in_out_receipt){
                            order.set_money_inout_details({
                                'operation': operation,
                                'reason': name,
                                'amount': amount,
                            });
                        }
                        if (self.pos.config.iface_cashdrawer){
                            self.pos.proxy.open_cashbox();
                        }
                        self.gui.close_popup();
                    }
                }).fail(function(error, event) {
                    alert("fail")
                    if (error.code === -32098) {
                        alert("Server closed...");
                        event.preventDefault();
                    }
                });
            }
            if(self.pos.config.money_in_out_receipt){
                this.gui.show_screen('receipt');
            }
        },
    });
    gui.define_popup({name:'cash_operation_popup', widget: CashOperationPopup});

//    Discard product popup
    var StockPickPopupWidget = PopupWidget.extend({
	    template: 'StockPickPopupWidget',
	    click_confirm: function(){
	    	var self = this;
	    	self.clear_cart();
	        this.gui.close_popup();
	    },
	    clear_cart: function(){
        	var self = this;
        	var order = this.pos.get_order();
        	var currentOrderLines = order.get_orderlines();
        	if(currentOrderLines && currentOrderLines.length > 0){
        		_.each(currentOrderLines,function(item) {
        			order.remove_orderline(item);
                });
        	} else {
        		return
        	}
        	self.clear_cart();
        },
	});
    gui.define_popup({name:'stock_pick', widget: StockPickPopupWidget});

//    Payment Summary Report
    var PaymentSummaryReportPopupWizard = PopupWidget.extend({
	    template: 'PaymentSummaryReportPopupWizard',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        var self = this;
	    	var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if(this.pos.config.current_month_date){
                $('input#start_date').val(first_date_of_month);
                $('input#end_date').val(today_date);
            }
            $("#start_date").change(function() {
                if($("#start_date").val()){
                     $('#start_date').css('border','');
                }
            });
            $("#end_date").change(function() {
                if($("#end_date").val()){
                    $('#end_date').css('border','');
                }
            });
            $('input#start_date').focus();
	    },
	    click_confirm: function(){
	        var self = this;
	        var order = this.pos.get_order();
	        var from_date = $('input#start_date').val();
	        var to_date = $('input#end_date').val();
	        var today_date = new Date().toISOString().split('T')[0];
	        var data = dropdown_data.value;
	        order.set_sales_summary_mode(true);
	        var pop_start_date = from_date.split('-');
            self.pos.from_date  = pop_start_date[2] + '-' + pop_start_date[1] + '-' + pop_start_date[0];
            var pop_end_date = to_date.split('-');
            self.pos.to_date  = pop_end_date[2] + '-' + pop_end_date[1] + '-' + pop_end_date[0];
            if(from_date == "" && to_date == "" || from_date != "" && to_date == "" || from_date == "" && to_date != "" ){
                if(!from_date){
                    $('#start_date').css('border','1px solid red');
                }
                if(!to_date){
                    $('#end_date').css('border','1px solid red');
                }
                return;
            } else if(from_date > to_date){
                alert("Start date should not be greater than end date");
            } else{
                var val = {
                    'start_date':from_date,
                    'end_date':to_date,
                    'summary': data
                }
                var params = {
                    model: 'pos.order',
                    method: 'payment_summary_report',
                    args: [val],
                }
                rpc.query(params, {async: false}).then(function(res){
                    if(res){
                        if(Object.keys(res['journal_details']).length == 0 && Object.keys(res['salesmen_details']).length == 0){
                            order.set_sales_summary_mode(false);
                            alert("No records found!");
                        } else{
                            order.set_sales_summary_vals(res);
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
                            if (self.pos.config.iface_print_via_proxy) {
                                var receipt = "";
                                receipt = QWeb.render('PaymentSummaryReportXmlReceipt', {
                                    widget: self,
                                    pos: self.pos,
                                    order: order,
                                    receipt: order.export_for_printing(),
                                    journal_details: journal_summary_data,
                                    salesmen_details: sales_summary_data,
                                    total_summary : total_summary_data
                                });
                               self.pos.proxy.print_receipt(receipt);
                            } else{
                                self.gui.show_screen('receipt');
                           }
                        }
                    }
                });
            }
	    },
	});
    gui.define_popup({name:'payment_summary_report_wizard', widget: PaymentSummaryReportPopupWizard});

//    Product Summary Report

    var ProductSummaryReportPopupWizard = PopupWidget.extend({
	    template: 'ProductSummaryReportPopupWizard',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        var self = this;
	        self.pos.signature = false;
	    	$('input#start_date').focus();
	    	var no_of_report = this.pos.config.no_of_copy_receipt;
	    	$('input#no_of_summary').val(no_of_report);
	    	var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if(this.pos.config.product_summary_month_date){
                $('input#start_date').val(first_date_of_month);
                $('input#end_date').val(today_date);
            }
            $("#start_date").change(function() {
                if($("#start_date").val() != ""){
                     $('#start_date').css('border','');
                }
            });
            $("#end_date").change(function() {
                if($("#end_date").val() != ""){
                    $('#end_date').css('border','');
                }
            });
            if(no_of_report <= 0){
	    	    $('input#no_of_summary').val(1);
	    	} else{
	    	    $('input#no_of_summary').val(no_of_report);
	    	}
            $("#no_of_summary").change(function() {
                if($("#no_of_summary").val() != ""){
                    $('#no_of_summary').css('border','');
                }
            });
            if(this.pos.config.signature){
                self.pos.signature = true;
            }
	    },
	    click_confirm: function(){
	        var self = this;
	        var from_date = $('input#start_date').val();
	        var to_date = $('input#end_date').val();
	        var no_of_copies = $('input#no_of_summary').val();
	        var order = this.pos.get_order();
	        var today_date = new Date().toISOString().split('T')[0];
            var report_value = [];
	        order.set_order_summary_report_mode(true);
            self.pos.from_date = from_date;
            self.pos.to_date = to_date;
            if(no_of_copies <= 0){
                 $('#no_of_summary').css('border','1px solid red');
                 return;
            }
            if($('input#product_summary').prop("checked") == true){
                var id = $('input#product_summary').attr("id");
                report_value.push(id)
            }
            if($('input#category_summary').prop("checked") == true){
                var id = $('input#category_summary').attr("id");
                report_value.push(id)
            }
            if($('input#location_summary').prop("checked") == true){
                var id = $('input#location_summary').attr("id");
                report_value.push(id)
            }
            if($('input#payment_summary').prop("checked") == true){
                var id = $('input#payment_summary').attr("id");
                report_value.push(id)
            }
            if(from_date == "" && to_date == "" || from_date != "" && to_date == "" || from_date == "" && to_date != "" ){
                if(from_date == ""){
                    $('#start_date').css('border','1px solid red');
                }
                if(to_date == ""){
                    $('#end_date').css('border','1px solid red');
                }
                return;
            } else if(from_date > to_date){
                alert("Start date should not be greater than end date");
            } else{
	            var val = {
	                'start_date':from_date,
	                'end_date':to_date,
	                'summary': report_value
	            }
	            var params = {
	                model: 'pos.order',
	                method: 'product_summary_report',
	                args: [val],
	            }
	            rpc.query(params, {async: false}).then(function(res){
	                if(res){
	                    if(Object.keys(res['category_summary']).length == 0 && Object.keys(res['product_summary']).length == 0 &&
	                        Object.keys(res['location_summary']).length == 0 && Object.keys(res['payment_summary']).length == 0){
	                        order.set_order_summary_report_mode(false);
	                        alert("No records found!");
	                    } else{
	                        self.pos.product_total_qty = 0.0;
	                        self.pos.category_total_qty = 0.0;
	                        self.pos.payment_summary_total = 0.0;
	                        if(res['product_summary']){
	                            _.each(res['product_summary'], function(value,key){
	                                    self.pos.product_total_qty += value;
	                                });
	                        }
	                        if(res['category_summary']){
	                            _.each(res['category_summary'], function(value,key) {
	                                    self.pos.category_total_qty += value;
	                                });
	                        }
	                        if(res['payment_summary']){
	                            _.each(res['payment_summary'], function(value,key) {
	                                    self.pos.payment_summary_total += value;
	                                });
	                        }
	                    order.set_product_summary_report(res);
	                    var product_summary_key = Object.keys(order.get_product_summary_report()['product_summary']);
	                    if(product_summary_key.length == 0){
	                        var product_summary_data = false;
	                    } else {
	                        var product_summary_data = order.get_product_summary_report()['product_summary'];
	                    }
	                    var category_summary_key = Object.keys(order.get_product_summary_report()['category_summary']);
	                    if(category_summary_key.length == 0){
	                        var category_summary_data = false;
	                    } else {
	                        var category_summary_data = order.get_product_summary_report()['category_summary'];
	                    }
	                    var payment_summary_key = Object.keys(order.get_product_summary_report()['payment_summary']);
	                    if(payment_summary_key.length == 0){
	                    var payment_summary_data = false;
	                    } else {
	                        var payment_summary_data = order.get_product_summary_report()['payment_summary'];
	                    }
	                    var location_summary_key = Object.keys(order.get_product_summary_report()['location_summary']);
	                    if(location_summary_key.length == 0){
	                        var location_summary_data = false;
	                    } else {
	                        var location_summary_data = order.get_product_summary_report()['location_summary'];
	                    }
	                    if (self.pos.config.iface_print_via_proxy) {
	                        var receipt = "";
	                        for (var step = 0; step < no_of_copies; step++) {
	                            receipt = QWeb.render('ProductSummaryReportXmlReceipt', {
	                                widget: self,
	                                pos: self.pos,
	                                order: order,
	                                receipt: order.export_for_printing(),
	                                product_details: product_summary_data,
	                                category_details:category_summary_data,
	                                payment_details: payment_summary_data,
	                                location_details:location_summary_data,
	                            });
	                            self.pos.proxy.print_receipt(receipt);
	                        }
	                    } else{
	                        self.gui.show_screen('receipt');
	                        }
	                    }
	                }
	            });
            }
	    },
	});
    gui.define_popup({name:'product_summary_report_wizard', widget: ProductSummaryReportPopupWizard});

    //    Operation Restrict 
    var ManagerAuthenticationPopup = PopupWidget.extend({
	    template: 'ManagerAuthenticationPopup',
	    show: function(options){
	    	var self = this;
	    	this.value = options.val || 0;
	    	options = options || {};
	        this._super(options);
	        this.renderElement();
	        $('#manager_barcode').focus();
	        $('#manager_barcode').keypress(function(e){
	        	if(e.which === 13){
	        		self.click_confirm();
	        	}
	        });
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var barcode_input = $('#manager_barcode').val();
	    	if(barcode_input){
		    	if(!$.isEmptyObject(self.pos.config.pos_managers_ids)){
		    		var result_find = _.find(self.pos.users, function (o) {
		    			return o.barcode === barcode_input;
		    		});
		    		if(result_find && !$.isEmptyObject(result_find)){
		    			if($.inArray(result_find.id, self.pos.config.pos_managers_ids) != -1){
		    				if(result_find.can_give_discount){
		    					if(self.value <= result_find.discount_limit || result_find.discount_limit < 1){
				    				self.pos.get_order().get_selected_orderline().set_discount(self.value);
				    				this.gui.close_popup();
		    					} else {
		    						alert(_t('out of your discount limit.'));
		    					}
		    				} else {
		    					alert(_t(result_find.name + ' does not have right to give discount.'));
	    				}
		    			} else {
		    				alert(_t('Not a Manager.'));
			    		}
		    		} else {
		    			alert(_t('No result found'));
		    			$('#manager_barcode').val('');
		    			$('#manager_barcode').focus();
		    		}
		    	}
	    	}else{
	    		alert(_t('Please enter barcode.'));
	    		$('#manager_barcode').focus();
	    	}
	    },
	});
	gui.define_popup({name:'ManagerAuthenticationPopup', widget: ManagerAuthenticationPopup});

//Order Summary Report
	var OrderSummaryPopupWidget = PopupWidget.extend({
	    template: 'OrderSummaryPopupWidget',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        $('input#start_date').focus();
	        var self = this;
	        var today_date = new Date().toISOString().split('T')[0];
	        self.pos.signature = false;
	        if (self.pos.config.order_summary_signature){
	        	self.pos.signature = true;
	        }
	        var date = new Date();
	        var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
	        var first_date = firstDay.toISOString().split('T')[0];
	    	var no_of_report = this.pos.config.order_summary_no_of_copies;
	    	if(no_of_report <= 0){
	    		$('input#no_of_copies').val(1);
	    	}else{
	    		$('input#no_of_copies').val(no_of_report);
	    	}
	        if(this.pos.config.order_summary_current_month){
	    		$('input#start_date').val(first_date);
	    		$('input#end_date').val(today_date);
	    	}
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var value = {};
	    	var order = this.pos.get_order();
	    	var num = $('input#no_of_copies').val()
	    	self.pos.from_date = $('input#start_date').val();
	    	self.pos.to_date = $('input#end_date').val();
	    	var today_date = new Date().toISOString().split('T')[0];
	    	var state = states.value;
	    	var custom_receipt = true;
	    	var report_list = [];
	    	var client = this.pos.get_client();
	    	order.set_receipt(custom_receipt);
	    	if($('input#order_summary_report').prop("checked") == true){
                var id = $('input#order_summary_report').attr("id");
                report_list.push(id)
            }
            if($('input#category_summary_report').prop("checked") == true){
                var id = $('input#category_summary_report').attr("id");
                report_list.push(id)
            }
            if($('input#payment_summary_report').prop("checked") == true){
                var id = $('input#payment_summary_report').attr("id");
                report_list.push(id)
            }
	    	if($('input#no_of_copies').val() <= 0){
	    		$('input#no_of_copies').css('border','1px solid red');
	    		return;
	    	}
    	   	if(self.pos.from_date == "" && self.pos.to_date == "" || self.pos.from_date != "" && self.pos.to_date == "" || self.pos.from_date == "" && self.pos.to_date != "" ){
    	   		if(self.pos.from_date == ""){
    	   			$('#start_date').css('border','1px solid red');
    	   		}
    	   		if(self.pos.to_date == ""){
    	   			$('#end_date').css('border','1px solid red');
    	   		}
    	   		return;
	   		} else if(self.pos.from_date > self.pos.to_date) {
	   			alert("End date must be greater");
	   			return;
	   		} else{
	   			value = {
   	    			'start_date' : self.pos.from_date,
   	    			'end_date' : self.pos.to_date,
   	    			'state' : state,
   	    			'summary' :report_list
   		    	}
   		    	var params = {
	    			model : 'pos.order',
	    			method : 'order_summary_report',
	    			args : [value],
   		    	}
   		    	rpc.query(params,{async:false}).then(function(res){
   		    		self.pos.state = false;
   		    		if(res['state']){
   		    			self.pos.state = true
   		    		}
   		    		if(res){
   		    			if(Object.keys(res['category_report']).length == 0 && Object.keys(res['order_report']).length == 0 &&
   		    					Object.keys(res['payment_report']).length == 0){
   		    					order.set_receipt(false);
   		    					alert("No records found!");
   		    			} else{
   			    			self.pos.total_categ_amount = 0.00;
   			    			self.pos.total_amount = 0.00;
   			    			if(res['category_report']){
   			    				if(self.pos.state){
   			    					_.each(res['category_report'], function(value,key) {
   				                        self.pos.total_categ_amount += value[1];
			                        });
   			    				}
   			    			}
   			    			if(res['payment_report']){
   			    				if(self.pos.state){
	   			    				_.each(res['payment_report'], function(value,key) {
		   		                        self.pos.total_amount += value;
		   		                    });
   			    				}
   			    			}
   			    			order.set_order_list(res);
   			    			if(order.get_receipt()) {
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
   				   		    	var receipt = '';
   				   		    	if(self.pos.config.iface_print_via_proxy){
   				   		    		for (var i=0;i < num;i++) {
   				   		    			receipt = QWeb.render('OrderXmlReceipt', {
   						    				widget: self,
   						    				pos: self.pos,
   						    				order: order,
   						    				receipt: order.export_for_printing(),
   						    				order_report : order_data,
   						    				category_report : category_data,
   						    				payment_report : payment_data,
   						    			});
   				   		    		}
   					   		    	self.pos.proxy.print_receipt(receipt);
   				   		    	} else{
   				   		    		self.gui.show_screen('receipt')
   				   		    	}
   			   		        }
   		    			}
   		    		}
   		    	});
	   		}
	    },
	});
	gui.define_popup({name:'order_summary_popup',widget: OrderSummaryPopupWidget});

	var CashControlWizardPopup = PopupWidget.extend({
        template : 'CashControlWizardPopup',
        show : function(options) {
            var self = this;
            options = options || {};
            this.title = options.title || ' ';
            this.statement_id = options.statement_id || false;
            var selectedOrder = self.pos.get_order();
            this._super();
            this.renderElement();
            var self = this;
            $(document).keypress(function (e) {
                if (e.which != 8 && e.which != 46 && e.which != 0 && (e.which < 48 || e.which > 57)) {
                    return false;
                }
            });
            var session_data = {
                model: 'pos.session',
                method: 'search_read',
                domain: [['id', '=', self.pos.pos_session.id]],
            }
            rpc.query(session_data, {async: false}).then(function(data){
                if(data){
                     _.each(data, function(value){
                        $("#open_bal").text(self.format_currency(value.cash_register_balance_start));
                        $("#transaction").text(self.format_currency(value.cash_register_total_entry_encoding));
                        $("#theo_close_bal").text(self.format_currency(value.cash_register_balance_end));
                        $("#real_close_bal").text(self.format_currency(value.cash_register_balance_end_real));
                        $("#differ").text(self.format_currency(value.cash_register_difference));
                        $('.button.close_session').show();
                     });
                }
            });
            $("#cash_details").show();
            this.$('.button.close_session').hide();
            this.$('.button.ok').click(function() {
                var dict = [];
                var items=[]
                var cash_details = []
                $(".cashcontrol_td").each(function(){
                    items.push($(this).val());
                });
                while (items.length > 0) {
                  cash_details.push(items.splice(0,3))
                }
                 _.each(cash_details, function(cashDetails){
                    if(cashDetails[2] > 0.00){
                        dict.push({
                           'coin_value':Number(cashDetails[0]),
                           'number_of_coins':Number(cashDetails[1]),
                           'subtotal':Number(cashDetails[2]),
                           'pos_session_id':self.pos.pos_session.id
                        });
                    }
                });
                if(dict.length > 0){
                    var params = {
                        model: 'pos.session',
                        method: 'cash_control_line',
                        args:[self.pos.pos_session.id,dict]
                    }
                    rpc.query(params, {async: false}).then(function(res){
                            if(res){
                            }
                    }).fail(function (type, error){
                        if(error.code === 200 ){    // Business Logic Error, not a connection problem
                           self.gui.show_popup('error-traceback',{
                                'title': error.data.message,
                                'body':  error.data.debug
                           });
                        }
                    });
                }
                var session_data = {
                    model: 'pos.session',
                    method: 'search_read',
                    domain: [['id', '=', self.pos.pos_session.id]],
                }
                rpc.query(session_data, {async: false}).then(function(data){
                    if(data){
                         _.each(data, function(value){
                            $("#open_bal").text(self.format_currency(value.cash_register_balance_start));
                            $("#transaction").text(self.format_currency(value.cash_register_total_entry_encoding));
                            $("#theo_close_bal").text(self.format_currency(value.cash_register_balance_end));
                            $("#real_close_bal").text(self.format_currency(value.cash_register_balance_end_real));
                            $("#differ").text(self.format_currency(value.cash_register_difference));
                            $('.button.close_session').show();
                         });
                    }
                });
    		});
            this.$('.button.close_session').click(function() {
                self.gui.close_popup();
                var params = {
                    model: 'pos.session',
                    method: 'custom_close_pos_session',
                    args:[self.pos.pos_session.id]
                }
                rpc.query(params, {async: false}).then(function(res){
                    if(res){
                        var pos_session_id = [self.pos.pos_session.id];
                        self.pos.chrome.do_action('flexipharmacy.pos_z_report',{
                        	additional_context:{
	                            active_ids:pos_session_id,
	                        }
                        }).fail(function(e){
                        	console.log("Error: ",e);
                        });
                        var cashier = self.pos.get_cashier() || get_current_date;
                    	if(cashier.login_with_pos_screen){
	                        setTimeout(function(){
	                            framework.redirect('/web/session/logout');
	                        }, 5000);
                    	}else{
                    		self.pos.gui.close();
                    	}
                     }
                }).fail(function (type, error){
                    if(error.code === 200 ){    // Business Logic Error, not a connection problem
                       self.gui.show_popup('error-traceback',{
                            'title': error.data.message,
                            'body':  error.data.debug
                       });
                    }
                });
            });
            this.$('.button.cancel').click(function() {
                self.gui.close_popup();
            });
        },
        renderElement: function() {
            var self = this;
            this._super();
            var selectedOrder = self.pos.get_order();
            var table_row = "<tr id='cashcontrol_row'>" +
                            "<td><input type='text'  class='cashcontrol_td coin' id='value' value='0.00' /></td>" + "<span id='errmsg'/>"+
                            "<td><input type='text' class='cashcontrol_td no_of_coin' id='no_of_values' value='0.00' /></td>" +
                            "<td><input type='text' class='cashcontrol_td subtotal' id='subtotal' disabled='true' value='0.00' /></td>" +
                            "<td id='delete_row'><span class='fa fa-trash-o'></span></td>" +
                            "</tr>";
            $('#cashbox_data_table tbody').append(table_row);
            $('#add_new_item').click(function(){
                $('#cashbox_data_table tbody').append(table_row);
            });
            $('#cashbox_data_table tbody').on('click', 'tr#cashcontrol_row td#delete_row',function(){
				$(this).parent().remove();
				self.compute_subtotal();
			});
            $('#cashbox_data_table tbody').on('change focusout', 'tr#cashcontrol_row td',function(){
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
                _.each($('#cashcontrol_row td #subtotal'), function(input){
                    if(Number(input.value) && Number(input.value) > 0){
                        subtotal += Number(input.value);
                    }
                });
                $('.subtotal_end').text(self.format_currency(subtotal));
            }
        }
    });
    gui.define_popup({name:'cash_control', widget: CashControlWizardPopup});

    var PackLotLinePopupWidget = PopupWidget.extend({
	    template: 'PackLotLinePopupWidget',
	    events: _.extend({}, PopupWidget.prototype.events, {
	        'click .remove-lot': 'remove_lot',
	        'click .select-lot': 'select_lot',
	        'keydown .popup-input': 'add_lot',
	        'blur .packlot-line-input': 'lose_input_focus',
	        'keyup .popup-search': 'seach_lot',
	    }),
	    show: function(options){
	        this._super(options);
	        this.focus();
	        var self = this;
	        var order = this.pos.get_order();
	        var serials = self.options.serials;
	        _.each(order.get_orderlines(),function(item) {
		        for(var i=0; i < item.pack_lot_lines.length; i++){
		        	var lot_line = item.pack_lot_lines.models[i];
	                if(serials.length != 0){
		                for(var j=0 ; j < serials.length ; j++){
		                	if(serials[j].name == lot_line.get('lot_name')){
		                		serials[j]['remaining_qty'] = serials[j]['remaining_qty'] - 1;
		                	}
		                }
	                }
		        }
            });
	        this.renderElement();
	    },
	    click_confirm: function(){
	        var order = this.pos.get_order();
            var order_line = order.get_selected_orderline();
	        var pack_lot_lines = this.options.pack_lot_lines;
	        this.$('.packlot-line-input').each(function(index, el){
	            var cid = $(el).attr('cid'),
	                lot_name = $(el).val();
	            var pack_line = pack_lot_lines.get({cid: cid});
	            pack_line.set_lot_name(lot_name);
	        });
	        pack_lot_lines.remove_empty_model();
	        if(order_line.product.tracking == 'serial'){
	            pack_lot_lines.set_quantity_by_lot();
	        } else{
	            this.set_quantity_by_lot(pack_lot_lines)
	        }
	        this.options.order.save_to_db();
	        this.gui.close_popup();
	    },
	    click_cancel: function(){
	    	if(!this.pos.config.enable_pos_serial){
	    		this.gui.close_popup();
	    		return
	    	}
	    	var pack_lot_lines = this.options.pack_lot_lines;
	    	if(pack_lot_lines.length > 0){
	    		if(!confirm(_t("Are you sure you want to unassign lot/serial number(s) ?"))){
		    		return
		    	}
	    	}
	    	var self = this;
	        this.$('.packlot-line-input').each(function(index, el){
	            var cid = $(el).attr('cid'),
	                lot_name = $(el).val();
	            var lot_model = pack_lot_lines.get({cid: cid});
		        lot_model.remove();
		        var serials = self.options.serials;
	            for(var i=0 ; i < serials.length ; i++){
	            	if(serials[i].name == lot_name){
	            		serials[i]['remaining_qty'] = serials[i]['remaining_qty'] + 1;
	            		break
	            	}
	            }
	        });
	        var order = this.pos.get_order();
	        var order_line = order.get_selected_orderline();
	        self.renderElement()
	        self.pos.chrome.screens.products.order_widget.rerender_orderline(order_line);
	        this.gui.close_popup();
	    },
	    get_valid_lots: function(lots){
            return lots.filter(function(model){
                return model.get('lot_name');
            });
        },
        set_quantity_by_lot: function(lot_lines) {
            var order = this.pos.get_order();
            var order_line = order.get_selected_orderline();
            var valid_lots = this.get_valid_lots(lot_lines.models);
            order_line.set_quantity(valid_lots.length);
        },
	    select_lot: function(ev) {
	    	var $i = $(ev.target);
            var data = $i.attr('data');
            var add_qty = $(ev.currentTarget).find("input").val();
            var order = this.pos.get_order();
            var order_line = order.get_selected_orderline();
            if(data && add_qty){
            	for(var i=0; i< add_qty;i++){
                	this.focus();
        	    	this.$("input[autofocus]").val(data);
        	    	this.add_lot(false,true);
                }
            }
	    },
	    add_lot: function(ev,val) {
	        if ((ev && ev.keyCode === $.ui.keyCode.ENTER)|| val){
	            var pack_lot_lines = this.options.pack_lot_lines,
	                $input = ev ? $(ev.target) : this.$("input[autofocus]"),
	                cid = $input.attr('cid'),
	                lot_name = $input.val();
                var serials = this.options.serials;
                if(serials.length != 0){
                	var flag = true
	                for(var i=0 ; i < serials.length ; i++){
	                	if(serials[i].name == lot_name){
	                		if((serials[i]['remaining_qty'] - 1) < 0){
	                			flag = true;
	                		} else {
	                			if(serials[i].life_date){
	                				if(moment(new moment().add(this.pos.config.product_exp_days, 'd').locale("en").format('YYYY-MM-DD HH:mm:mm')).format('DD/MM/YYYY') < moment(serials[i].life_date).format('DD/MM/YYYY')){
		                				serials[i]['remaining_qty'] = serials[i]['remaining_qty'] - 1;
			                			flag = false;
		                			}
	                			}else{
	                				serials[i]['remaining_qty'] = serials[i]['remaining_qty'] - 1;
		                			flag = false;
	                			}
	                		}
	                		break
	                	}
	                }
	                if(flag){
	                	$input.css('border','5px solid red');
	                	$input.val('');
	                	return
	                }
                }
	            var lot_model = pack_lot_lines.get({cid: cid});
	            lot_model.set_lot_name(lot_name);  // First set current model then add new one
	            if(!pack_lot_lines.get_empty_model()){
	                var new_lot_model = lot_model.add();
	                this.focus_model = new_lot_model;
	            }
	            pack_lot_lines.set_quantity_by_lot();
	            this.renderElement();
	            this.focus();
	        }
	    },
	    remove_lot: function(ev){
	        var pack_lot_lines = this.options.pack_lot_lines,
	            $input = $(ev.target).prev(),
	            cid = $input.attr('cid'),
	        	lot_name = $input.val();
	        if(lot_name){
	        	var lot_model = pack_lot_lines.get({cid: cid});
		        lot_model.remove();
		        pack_lot_lines.set_quantity_by_lot();
		        var serials = this.options.serials;
	            for(var i=0 ; i < serials.length ; i++){
	            	if(serials[i].name == lot_name){
	            		serials[i]['remaining_qty'] = serials[i]['remaining_qty'] + 1;
	            		break
	            	}
	            }
		        this.renderElement();
	        }
	    },
	    seach_lot: function(ev){
	    	var self = this;
	    	var valThis = $(ev.target).val().toLowerCase();
	    	var sr_list = [];
	        $('.select-lot').each(function(){
	        	var text = $(this).attr('data');
		        (text.indexOf(valThis) == 0) ? sr_list.push(text) : "";
		    });
	        var serials = this.options.serials;
	        var sr = [];
	        var all_sr = [];
            for(var i=0 ; i < serials.length ; i++){
            	if($.inArray(serials[i].name, sr_list) !== -1 && serials[i].remaining_qty > 0){
            		sr.push(serials[i]);
            	}
            	if(serials[i].remaining_qty > 0){
            		all_sr.push(serials[i])
            	}
            }
            if(sr.length != 0 && valThis != ""){
            	this.render_list(sr);
            } else {
            	this.render_list(all_sr);
            }
	    },
	    render_list: function(orders){
	    	if(!orders){
	    		return
	    	}
        	var self = this;
            var contents = $('.serial-list-contents');
            contents.html('');
            var temp = [];
            for(var i = 0, len = Math.min(orders.length,1000); i < len; i++){
                var serial    = orders[i];
                serial.check_expire_alert =moment(new moment().add(self.pos.config.product_exp_days, 'd').locale("en").format('YYYY-MM-DD HH:mm:mm')).format('YYYY/MM/DD');
                serial.check_serial_life =moment(serial.life_date).locale("en").format('YYYY/MM/DD');
            	var clientline_html = QWeb.render('listLine',{widget: this, serial:serial});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.append(clientline);
            }
            $("table#lot_list").simplePagination({
				previousButtonClass: "btn btn-danger",
				nextButtonClass: "btn btn-danger",
				previousButtonText: '<i class="fa fa-angle-left fa-lg"></i>',
				nextButtonText: '<i class="fa fa-angle-right fa-lg"></i>',
				perPage:10
			});
        },
	    lose_input_focus: function(ev){
	        var $input = $(ev.target),
	            cid = $input.attr('cid');
	        var lot_model = this.options.pack_lot_lines.get({cid: cid});
	        lot_model.set_lot_name($input.val());
	    },
	    renderElement: function(){
	    	this._super();
	    	var serials = this.options.serials;
	    	var serials_lst = []
	    	if(serials){
	    		for(var i=0 ; i < serials.length ; i++){
	            	if(serials[i].remaining_qty > 0){
	            		serials_lst.push(serials[i])
	            	}
	            }
		    	this.render_list(serials_lst);
	    	}
	    },
	    focus: function(){
	        this.$("input[autofocus]").focus();
	        this.focus_model = false;   // after focus clear focus_model on widget
	    }
	});
	gui.define_popup({name:'packlotline', widget:PackLotLinePopupWidget});

	var ReportPopupWidget = PopupWidget.extend({
        template: 'ReportPopupWidget',
        events: _.extend({}, PopupWidget.prototype.events, {
    		'click .report_pdf.session': 'session_report_pdf',
    		'click .report_thermal.session': 'session_report_thermal',
    		'click .report_pdf.location': 'location_report_pdf',
    		'click .report_thermal.location': 'location_report_thermal',
    		'click .tablinks':'tablinks',
    	}),
        show: function(options){
            options = options || {};
            this._super(options);
            this.enable_thermal_print = this.pos.config.iface_print_via_proxy || false;
            this.renderElement();
        },
        tablinks: function(event){
        	var cityName = $(event.currentTarget).attr('value');
        	var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(cityName).style.display = "block";
            event.currentTarget.className += " active";
        },
        session_report_pdf: function(e){
        	var self = this;
        	var session_id = $(e.currentTarget).data('id');
        	self.pos.chrome.do_action('flexipharmacy.report_pos_inventory_session_pdf_front',{additional_context:{
                active_ids:[session_id],
            }}).fail(function(){
            	alert("Connection lost");
            });
        },
        session_report_thermal: function(e){
        	var self = this;
        	var session_id = $(e.currentTarget).data('id');
        	var report_name = "flexipharmacy.front_inventory_session_thermal_report_template";
            var params = {
				model: 'ir.actions.report',
				method: 'get_html_report',
				args: [session_id, report_name],
			}
			rpc.query(params, {async: false})
			.then(function(report_html){
				if(report_html && report_html[0]){
					self.pos.proxy.print_receipt(report_html[0]);
				}
			});
        },
        location_report_pdf: function(e){
        	var self = this;
        	var location_id = $(e.currentTarget).data('id');
        	self.pos.chrome.do_action('flexipharmacy.report_pos_inventory_location_pdf_front',{additional_context:{
                active_ids:[location_id],
            }}).fail(function(){
            	alert("Connection lost");
            });
        },
        location_report_thermal: function(e){
        	var self = this;
        	var location_id = $(e.currentTarget).data('id');
        	var report_name = "flexipharmacy.front_inventory_location_thermal_report_template";
            var params = {
				model: 'ir.actions.report',
				method: 'get_html_report',
				args: [location_id, report_name],
			}
			rpc.query(params, {async: false})
			.then(function(report_html){
				if(report_html && report_html[0]){
					self.pos.proxy.print_receipt(report_html[0]);
				}
			});
        },
    });
    gui.define_popup({name:'report_popup', widget: ReportPopupWidget});

    var create_po_popup = PopupWidget.extend({
	    template: 'CreatePurchaseOrderPopupWizard',
	    show: function(options){
	        options = options || {};
	        this._super(options);
	        var self = this;
	        self.renderElement()
	        self.list_products = options.list_products;
	        var supplier_list = self.pos.db.get_supplier_list();
//	        $("#loading").hide();
	        $('#select_supplier').keypress(function(e){
                $('#select_supplier').autocomplete({
                    source:supplier_list,
                    select: function(event, ui) {
                        self.supplier_id = ui.item.id;
                    },
                });
            });
            $('.product-detail-list').on('click', 'tr.product-line td#delete_row',function(){
				$(this).parent().remove();
			});
	    },
	    click_confirm: function(){
	        var self = this;
	        var product_detail = {};
	        var supplier = $('#select_supplier').val();
            $('.select_qty_product').map(function(ev){
                var product_id = $(this).attr('data-id');
                var product_qty = $(this).val();
                var product = self.pos.db.get_product_by_id(Number(product_id));
                product_detail[product_id] = product_qty;
            });
            var send_mail = $("#create_po_mail").val();
            var val = {
                'supplier_id':self.supplier_id,
                'send_mail':send_mail,
                'product_detail': product_detail
            }
            var params = {
                model: 'purchase.order',
                method: 'create_po',
                args: [val],
            }
            $('.freeze_screen').addClass("active_state");
//            $('.loading').css('display','block');
            rpc.query(params, {async: false}).then(function(result){
                if(result && result[0] && result[0]){
                    $('.freeze_screen').removeClass("active_state");
//                    $('.loading').css('display','none');
                    self.gui.close_popup();
                    var url = window.location.origin + '#id=' + result[0] + '&view_type=form&model=purchase.order';
                    self.pos.gui.show_popup('purchase_order_created', {'url':url, 'name':result[1]});
                }
            });
	    },
	});
    gui.define_popup({name:'create_purchase_order_popup', widget: create_po_popup});

    var PurchaseOrderPopupWidget = PopupWidget.extend({
	    template: 'PurchaseOrderPopupWidget',
	    click_confirm: function(){
	    	var self = this;
	        this.gui.close_popup();
	    	self.gui.show_screen('products');
	    },
	});
	gui.define_popup({name:'purchase_order_created', widget: PurchaseOrderPopupWidget});

//	Multi-Store Popup
	var MultiStorePopupWidget = PopupWidget.extend({
	    template: 'MultiStorePopupWidget',
	    show: function(options){
	    	var self = this;
	        options = options || {};
	        self.cashier_store = options.cashier_store;
	        self._super(options);
	        self.selected_id = false;
	        self.renderElement();
	    },
	    renderElement: function(){
	    	var self = this;
	    	self._super();
	    	$('.store-list li').click(function(){
	    		var id = $(this).attr('id');
	    		self.selected_id = Number(id);
	    		if($(this).hasClass('change_location')){
	    			$('.store').removeClass('change_location')
	    		}else {
	    			$('.store').removeClass('change_location')
	    			$(this).addClass('change_location');
	    		}
	    	});
	    },
	    click_confirm: function(){
	    	var self = this;
	    	var user_company = self.pos.get_cashier();
	    	self.pos.store_rec = self.pos.shop_by_id[self.selected_id];
	    	if(self.pos.store_rec){
                var params = {
                    model: 'pos.session',
                    method: 'write',
                    args: [self.pos.pos_session.id,{'shop_id':Number(self.selected_id)}],
                }
                if(self.selected_id){
                    rpc.query(params, {async: false}).then(function(result){
                    if(result){
                            self.pos.store = self.pos.shop_by_id[self.selected_id];
                        }
                    });
                }
                var store_manager = {
                    model: 'pos.shop',
                    method: 'write',
                    args: [self.selected_id,{'store_manager':self.pos.get_cashier().id}],
                }
                if(self.selected_id){
                    rpc.query(store_manager, {async: false}).then(function(result){
                    if(result){
                            self.pos.store_manager = self.pos.pos_session.user_id[0];
                        }
                    });
                }
                var param_config = {
                    model: 'pos.config',
                    method: 'write',
                    args: [self.pos.config.id,{'stock_location_id':self.pos.store_rec.location_id[0],'multi_shop_id':self.pos.store_rec.id}],
                }
                if(self.selected_id){
                    if(self.selected_id == self.pos.pos_session.shop_id[0]){
                        return;
                    }
                    else{
                        rpc.query(param_config, {async: false}).then(function(result){
                            if(result){
                                self.pos.shop = self.pos.store_rec.location_id[1];
                                self.pos.db.notification('success',_t(self.pos.shop + ' switched successfully.'));
                            } else {
                                self.pos.db.notification('error',_t('Could not switch to store.'));
                            }
                        }).fail(function(type,error){
                            if(error.data.message){
                                self.pos.db.notification('error',error.data.message);
                            }
                        });
                        location.reload();
                    }
                } else {
                    self.pos.db.notification('error',_t("Store not found"));
                }
            }
            self._super();
	    },
	});
	gui.define_popup({name:'multi_store_popup', widget: MultiStorePopupWidget});

	var AddMoneyToCreditPopup = PopupWidget.extend({
        template: 'AddMoneyToCreditPopup',
	    show: function(options){
	        var self = this;
	        this.client = options.new_client ? options.new_client : false;
	        var cust_due = this.pos.get_customer_due(this.client);
	        this.cust_due = cust_due.toFixed(2);
            this._super();
            $('#amount-to-be-added').focus();
	    },
	    click_confirm: function(){
            var self = this;
            var order = this.pos.get_order();
            if($('#amount-to-be-added').val() == ""){
                alert(_t('Please, enter amount!'));
                return;
            }
            var get_journal_id = Number($('.select-journal').val());
            var amt_due = self.cust_due;
            var amount = Number($('#amount-to-be-added').val());
            var pos_session_id = self.pos.pos_session.name;
            var partner_id = Number($('.client-line.highlight').attr('-id')) || Number($('.client-line.lowlight').attr('data-id'));
            var client = self.pos.get_order().get_client()
            partner_id = partner_id ? partner_id : client.id;
            var cashier_id = self.pos.get_cashier().id;
            this.pay_due = $("#pay_amount").prop('checked');
            var params = {
                model: 'account.payment',
                method: "payment",
                args: [get_journal_id, amount, pos_session_id,partner_id,this.pay_due],
            }
            rpc.query(params, {async: false}).then(function(vals){
                if(vals){
                	if(vals.affected_order && vals.affected_order[0]){
                		if(self.pos.get('pos_order_list') && self.pos.get('pos_order_list').length > 0){
                			_.each(self.pos.get('pos_order_list'),function(order){
                				_.each(vals.affected_order,function(new_order){
                					if(order.id == new_order[0].id){
                						if(new_order[0].amount_total && new_order[0].amount_paid){
                							order.amount_due = new_order[0].amount_total - new_order[0].amount_paid;
            							}
                					}
                				});
                			});
                		}
                	}
                	var partner = self.pos.db.get_partner_by_id(partner_id);
                	partner.remaining_credit_amount = vals.credit_bal;
                    self.gui.show_screen('receipt');
                    $('.pos-receipt-container', this.$el).html(QWeb.render('AddedCreditReceipt',{
                        widget: self,
                        order: order,
                        get_journal_id: get_journal_id,
                        amount: vals.credit_bal,
                        amt_due: vals.amount_due,
                        pay_due: self.pay_due,
                        partner_id: partner_id,
                    }));
                }
            });
        },
        renderElement: function() {
            var self = this;
	    	self._super();
            $('#pay_amount').click(function(){
                if (!$(this).is(':checked')) {
                    $("#amount-to-be-added").val("");
                }else{
                    $("#amount-to-be-added").val(self.cust_due)
                }
            })
        },
        export_as_JSON: function() {
            var pack_lot_ids = [];
            if (this.has_product_lot){
                this.pack_lot_lines.each(_.bind( function(item) {
                    return pack_lot_ids.push([0, 0, item.export_as_JSON()]);
                }, this));
            }
            return {
                qty: this.get_quantity(),
                price_unit: this.get_unit_price(),
                discount: this.get_discount(),
                product_id: this.get_product().id,
                tax_ids: [[6, false, _.map(this.get_applicable_taxes(), function(tax){ return tax.id; })]],
                id: this.id,
                pack_lot_ids: pack_lot_ids
            };
        },
    });
    gui.define_popup({name:'AddMoneyToCreditPopup', widget: AddMoneyToCreditPopup});

//  Credit Management
    var PrintCustomerCreditDetailPopup = PopupWidget.extend({
        template: 'PrintCustomerCreditDetailPopup',
        show: function(options){
        	var self = this;
        	self._super(options);
        	$('.start-date input').focus();
        },
        click_confirm: function(){
            var self = this;
            var order = self.pos.get_order();
            var start_date = $('.start-date input').val();
            var end_date = $('.end-date input').val();
            var customer_id = self.pos.gui.screen_instances.customercreditlistscreen.get_cust_id();
            customer_id = customer_id ? customer_id : self.pos.get_client().id;
            var partner = self.pos.db.get_partner_by_id(customer_id);
        	if(partner.parent_id){
    			partner = self.pos.db.get_partner_by_id(partner.parent_id[0]);
    		} else{
    			partner = self.pos.db.get_partner_by_id(customer_id)
    		}
            var account_id = partner.property_account_receivable_id;
            if(start_date > end_date){
                alert("Start date should not be greater than end date");
                return
            }
            if(start_date && end_date){
                var params = {
                    model: "account.move.line",
                    method: "search_read",
                    domain: [['date_maturity', '>=', start_date  + " 00:00:00"],['date_maturity', '<=', end_date + " 23:59:59"],
                             ['partner_id','=',partner.id],['account_id','=',account_id[0]]],
                }
                rpc.query(params, {async: false})
                .then(function(vals){
                    if(vals){
                        if(partner && vals.length > 0){
                            self.gui.show_screen('receipt');
                            partner = self.pos.db.get_partner_by_id(customer_id);
                            $('.pos-receipt-container', this.$el).html(QWeb.render('AddedCreditStatement',{
                                widget: self,
                                order: order,
                                move_line:vals,
                                partner:partner
                            }));
                        } else{
                            return
                        }
                    }
                });
            }
            else if(start_date == "" && end_date !== ""){
                $('.start-date input').css({'border-style': 'solid','border-width': '1px',
                    'border-color': 'rgb(255, 0, 0)'});
                $('.end-date input').css({'border-color': 'rgb(224,224,224)'});
            }else if(end_date == "" && start_date !== ""){
                $('.end-date input').css({'border-style': 'solid','border-width': '1px',
                    'border-color': 'rgb(255, 0, 0)'});
                $('.start-date input').css({'border-color': 'rgb(224,224,224)'});
            }else{
                $('.start-date input, .end-date input').css({'border-style':'solid', 'border-width': '1px',
                    'border-color': 'rgb(255, 0, 0)'});
            }
        },
    });
    gui.define_popup({name:'print_credit_detail_popup', widget: PrintCustomerCreditDetailPopup});

    var PayDebutPopup = PopupWidget.extend({
        template: 'PayDebutPopup',
	    show: function(options){
	        var self = this;
	        var partner = self.pos.get_client();
	        this.cust_due = this.pos.get_customer_due(partner).toFixed(2);
            this._super();
            $('#amount-to-be-pay').focus();
	    },
	    click_confirm: function(){
            var self = this;
            var order = this.pos.get_order();
            var amount = $('#amount-to-be-pay').val();
            if(!amount){
                alert(_t('Please, enter amount!'));
                return;
            }
            if(amount <= 0){
            	self.pos.db.notification('danger',"Enter valid amount!");
            	return;
            }
            if(Number(amount) > Number(self.cust_due)){
            	self.pos.db.notification('danger',"Pay should be less then or equal to Due amount");
            	return;
            }
            var get_journal_id = Number($('#select-journal :selected').val());
            var amt_due = self.cust_due;
            var amount = Number(amount);
            var pos_session_id = self.pos.pos_session.name;
            var partner_id = Number($('.client-line.highlight').attr('-id')) || Number($('.client-line.lowlight').attr('data-id'));
            var client = self.pos.get_order().get_client()
            partner_id = partner_id ? partner_id : client.id;
            var cashier_id = self.pos.get_cashier().id;
            var params = {
                model: 'account.payment',
                method: "payment",
                args: [get_journal_id, amount, pos_session_id, partner_id, true],
            }
            rpc.query(params, {async: false}).then(function(vals){
                if(vals){
                	if(vals.affected_order && vals.affected_order[0]){
                		if(self.pos.get('pos_order_list') && self.pos.get('pos_order_list').length > 0){
                			_.each(self.pos.get('pos_order_list'),function(order){
                				_.each(vals.affected_order,function(new_order){
                					if(order.id == new_order[0].id){
                						if(new_order[0].amount_total && new_order[0].amount_paid){
                							order.amount_due = new_order[0].amount_total - new_order[0].amount_paid;
            							}
                					}
                				});
                			});
                		}
                	}
                	var partner = self.pos.db.get_partner_by_id(partner_id);
                	partner.remaining_credit_amount = vals.credit_bal;
                    self.gui.show_screen('receipt');
                    $('.pos-receipt-container', this.$el).html(QWeb.render('PayDebitReceipt',{
                        widget: self,
                        order: order,
                        get_journal_id: get_journal_id,
                        amount: amount,
                        amt_due: vals.amount_due,
                        pay_due: self.pay_due,
                        partner_id: partner_id,
                    }));
                }
            });
        },
        renderElement: function() {
            var self = this;
	    	self._super();
            $('#pay_amount').click(function(){
                if (!$(this).is(':checked')) {
                    $("#amount-to-be-added").val("");
                }else{
                    $("#amount-to-be-added").val(self.cust_due)
                }
            })
        },
        export_as_JSON: function() {
            var pack_lot_ids = [];
            if (this.has_product_lot){
                this.pack_lot_lines.each(_.bind( function(item) {
                    return pack_lot_ids.push([0, 0, item.export_as_JSON()]);
                }, this));
            }
            return {
                qty: this.get_quantity(),
                price_unit: this.get_unit_price(),
                discount: this.get_discount(),
                product_id: this.get_product().id,
                tax_ids: [[6, false, _.map(this.get_applicable_taxes(), function(tax){ return tax.id; })]],
                id: this.id,
                pack_lot_ids: pack_lot_ids
            };
        },
    });
    gui.define_popup({name:'pay_debit_popup', widget: PayDebutPopup});

});