odoo.define('flexipharmacy.action_manager', function (require) {
"use strict";

var ViewManager = require('web.ViewManager');
var Context = require('web.Context');
var rpc = require('web.rpc');
var Session = require('web.Session');
var ActionManager = require('web.ActionManager');

var auto_refresh = false;

	ViewManager.include({
		do_execute_action: function (action_data, env, on_closed) {
			var self = this;
			if(env.model == 'wizard.pos.x.report' && action_data.id == 'main_print_button'){
				var $session_ids = $("div[name='session_ids']").find('.badge');
				var report_type = $("select[name='report_type']").val();
				var session_ids = [];
				$session_ids.map(function(session){
					var session_id = $(this).attr('data-id');
					if(Number(session_id)){
						session_ids.push(Number(session_id));
					}
				});
	
	    		return self.do_action('flexipharmacy.pos_x_report',{additional_context:{
	                active_ids:session_ids,
	            }}).fail(function(){
	            	alert("Connection lost");
	            });
			}else{
				return self._super(action_data, env, on_closed);
			}
		},
		switch_mode: function(view_type, view_options) {
	        var self = this;
	        var result = self._super(view_type, view_options);
	        var xml_ids = ['flexipharmacy.action_all_order_kanban_view', 'flexipharmacy.action_all_items_kanban_view']
	        if($.inArray(self.action.xml_id, xml_ids) != -1){
	        	var params = {
					model: 'res.company',
					method: 'get_refresh_rate',
					args: [],
				}
				rpc.query(params, {async: false}).then(function(result){
					if(result){
						auto_refresh = true;
	                    self.set_auto_refresh(result);
					}
				});
	        }
	        return result;
		},
		set_auto_refresh: function(rate){
	        var self = this;
	        if(auto_refresh){
	            setTimeout(function(){
	                self.searchview.do_search();
	                self.set_auto_refresh(rate)
	            }, rate*1000);
	        }
	    },
	});
});