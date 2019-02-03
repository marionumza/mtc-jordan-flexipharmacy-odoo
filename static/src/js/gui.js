odoo.define('flexipharmacy.gui', function (require) {
"use strict";

	var gui = require('point_of_sale.gui');
	var core = require('web.core');

	var _t = core._t;

	gui.Gui.include({
        authentication_pin: function(password) {
            var self = this;
            var ret = new $.Deferred();
            var flag = false;
            self.show_popup('password',{
                'title': _t('Password ?'),
                confirm: function(pw) {
                    _.each(password, function(pass) {
                        if (pw === pass) {
                            flag = true;
                        }
                    });
                    if(flag){
                        ret.resolve();
                    } else {
                        self.show_popup('error',_t('Incorrect Password'));
                        ret.reject()
                    }
                },
            });
            return ret;
        },
    });
});