odoo.define('flexipharmacy.keyboard', function (require) {
	"use strict";

	var models = require('point_of_sale.models');
	var screens = require('point_of_sale.screens');

//	models.load_fields("account.journal", ['shortcut_key']);
//    models.load_fields("res.company", ['pos_price', 'pos_quantity', 'pos_discount', 'pos_search', 'pos_next']);

    screens.ScreenWidget.include({
    	init: function(parent,options){
			var self = this;
	        this._super(parent,options);
	        this.keydown_shortcut = function(event){
	        	event.stopImmediatePropagation();
	        	if(self.pos.config.enable_keyboard_shortcut ){
	        		self.keyboard_shortcuts(event);
	        	}
	        	if(self.pos.pricelists && self.pos.pricelists.length > 1){
	        		self.keyboard_pricelist(event);
	        	}
			};
			this.keydown_pricelist = function(event){
	        	event.stopImmediatePropagation();
	        	self.keyboard_pricelist(event);
	        };
	    },
    	start: function(){
			var self = this;
			this._super();
			if(self.pos.config.enable_keyboard_shortcut || self.pos.pricelists && self.pos.pricelists.length > 1 ){
				console.log(" start method")
//				$(document).keydown(_.bind(this.keydown_shortcut, self));
			}
		},
		keyboard_shortcuts: function(event){
			var self = this;
			 // If input box or text area focused then it will return
	        if($(':focus').prop("tagName") == "INPUT" || $(':focus').prop("tagName") == 'TEXTAREA'){
            	return
        	}
			var order = this.pos.get_order();
			var current_screen = self.gui.get_current_screen();
			var keytostring = event.key;
			// Company Setting
			var qty = self.pos.company.pos_quantity || '';
            var search = self.pos.company.pos_search || '';
            var discount = self.pos.company.pos_discount || '';
	        var price = self.pos.company.pos_price || '';
	        var next_order = self.pos.company.pos_next || '';
	        var payment_total = self.pos.company.payment_total || '';
	        
	        if (event.which == 0 || event.keyCode === 27){// esc key for Cancel and Back
        		if(self.pos.gui.current_popup){	
        			var current_popup_el = self.pos.gui.current_popup.el;
                	$(current_popup_el).find('.button.cancel').click();
                	$(current_popup_el).find('.close_btn').click();
                	return
        		}
        		if(self.pos.gui.current_screen){
        			var current_popup_el = self.pos.gui.current_screen.el;
                	$(current_popup_el).find('.button.back').click();
                	return
        		}
        	} else if(event.keyCode === 13){
        		if(self.pos.gui.current_popup){	
        			var current_popup_el = self.pos.gui.current_popup.el;
                	$(current_popup_el).find('.button.confirm').click();
                	return
        		}
        	}
	        // keyboard Shortcuts
	        if(current_screen === "products"){
	        	// focus on product search box (Working)
				if(keytostring === search){
					self.pos.gui.screen_instances.products.el.querySelector('.searchbox input').focus();
					event.preventDefault();
				}
	        	if(order.get_selected_orderline()){
			        // select QTY Mode of numpad
					if(keytostring === qty){
						$(self.pos.gui.screen_instances.products.numpad.$el[2]).find("button[data-mode='quantity']").trigger('click');
					}
					// select Disc Mode of numpad
					if(keytostring === discount){
						$(self.pos.gui.screen_instances.products.numpad.$el[2]).find("button[data-mode='discount']").trigger('click');
					}
					// select Price Mode of numpad
					if(keytostring === price){
						$(self.pos.gui.screen_instances.products.numpad.$el[2]).find("button[data-mode='price']").trigger('click');
					}
					
					// payment screen
					if(keytostring === payment_total){
						$('#total_pay').click();
					}
					// Trigger Numpad Numeric Click
					if(self.pos.config.enable_keyboard_shortcut && !self.pos.config.is_scan_product){
                        if($.isNumeric(keytostring) || keytostring === '.' || keytostring === ','){
                            if(keytostring === ',') keytostring = '.'
                            $(self.pos.gui.screen_instances.products.numpad.$el[2]).find(".number-char:contains("+ keytostring +")").click();
                        }
                    }
					// BackSpace of Numpad
					if(event.keyCode === $.ui.keyCode.BACKSPACE){
						$(self.pos.gui.screen_instances.products.numpad.$el[2]).find(".input-button.numpad-backspace").trigger('click');
					}
	        	}
	        } 
	        else if(current_screen === "receipt"){
	        	if(keytostring === next_order){
	        		self.pos.gui.screen_instances.receipt.click_next();
	        	}
	        }
		},
		keyboard_pricelist: function(event){
			var self = this;
			if($(':focus').prop("tagName") == "INPUT" || $(':focus').prop("tagName") == 'TEXTAREA'){
            	return
        	}
			if(self.gui.get_current_screen() === "products"){
				var keytostring = event.key;
				var current_popup = self.gui.current_popup;
				if(keytostring === self.pos.config.open_pricelist_popup){
					self.pos.gui.screen_instances.products.action_buttons.set_pricelist.button_click();
				}
			}
			if(current_popup){
				if(event.keyCode === $.ui.keyCode.ESCAPE){
					current_popup.click_cancel();
				}
				if(event.keyCode === $.ui.keyCode.UP){
					var prev_el = $('.selection-item.selected').prev();
					if(prev_el.length > 0){
						$('.selection-item.selected').removeClass('selected')
						$(prev_el).addClass('selected');
					}
				}
				if(event.keyCode === $.ui.keyCode.DOWN){
					var next_el = $('.selection-item.selected').next();
					if(next_el.length > 0){
						$('.selection-item.selected').removeClass('selected')
						$(next_el).addClass('selected');
					}
				}
				if(event.keyCode === $.ui.keyCode.ENTER){
					if(current_popup.list){
						var item = current_popup.list[parseInt($('.selection-item.selected').data('item-index'))]
						if(item && item.item){
							current_popup.options.confirm.call(self,item.item);
							current_popup.gui.close_popup();
						}
					}
				}
			}
			
		},
    });
    screens.PaymentScreenWidget.include({
    	init: function(parent, options) {
            var self = this;
            this._super(parent, options);
            this.keyboard_shortcut = function(event){
            	if(self.gui.get_current_screen() === "payment"){
	            	var keytostring = event.key;
	            	var selected_payment_method = _.find(self.pos.cashregisters, function(cashregister){
		        		return cashregister.journal.shortcut_key === keytostring;
		        	})
		        	if(selected_payment_method){
		        		self.click_paymentmethods(selected_payment_method.journal_id[0]);
		        	}
            	}
            	event.stopImmediatePropagation();
            };
    	},
    	show: function(){
    		var self = this;
    		this._super();
    		if(self.pos.config.enable_keyboard_shortcut){
    			$(document).keypress(_.bind(this.keyboard_shortcut, self));
    		}
    	},
    })
});