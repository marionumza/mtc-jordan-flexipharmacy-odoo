/**
 * jquery.simplePagination.js
 * @version: v1.0.0
 * @author: Sebastian Marulanda http://marulanda.me
 * @see: https://github.com/smarulanda/jquery.simplePagination
 */

(function($) {

	$.fn.simplePagination = function(options) {
		
		var defaults = {
			perPage: 5,
			containerClass: '',
			previousButtonClass: '',
			nextButtonClass: '',
			previousButtonText: 'Previous',
			nextButtonText: 'Next',
			currentPage: 1,
		};
		
		$.fn.simplePagination.destroy = function(){
		}
		var settings = $.extend({}, defaults, options);

		return this.each(function() {
			var $rows = $('tbody tr', this);
			var pages = Math.ceil($rows.length/settings.perPage);
			
//			var container = document.createElement('div');
			var container = document.getElementById('pagination');
			var bPrevious = document.getElementById('previous');
			var bNext = document.getElementById('next');
			var bFirst = document.getElementById('first');
			var bLast = document.getElementById('last');
			var of = document.getElementById('text');
				
			bPrevious.innerHTML = settings.previousButtonText;
			bNext.innerHTML = settings.nextButtonText;

			container.className = settings.containerClass;
			bPrevious.className = settings.previousButtonClass;
			bNext.className = settings.nextButtonClass;

			bPrevious.style.marginRight = '8px';
			bPrevious.style.background = '#59697d';
			bPrevious.style.color = '#FFF';
			bNext.style.marginLeft = '8px';
			bNext.style.background = '#59697d';
			bNext.style.color = '#FFF';
			bFirst.style.marginRight = '8px';
			bFirst.style.background = '#59697d';
			bFirst.style.color = '#FFF';
			bLast.style.marginLeft = '8px';
			bLast.style.background = '#59697d';
			bLast.style.color = '#FFF';
			container.style.textAlign = "center";
			container.style.marginBottom = '20px';

			container.appendChild(bFirst);
			container.appendChild(bPrevious);
			container.appendChild(of);
			container.appendChild(bNext);
			container.appendChild(bLast);
			$('.order-list-scroll').after(container);

			update();

			$(bNext).click(function() {
				if (settings.currentPage + 1 > pages) {
					settings.currentPage = pages;
				} else {
					settings.currentPage++;
				}

				update();
			});

			$(bPrevious).click(function() {
				if (settings.currentPage - 1 < 1) {
					settings.currentPage = 1;
				} else {
					settings.currentPage--;
				}

				update();
			});
			$(bFirst).click(function(){
				settings.currentPage = 1;
				update();
			});
			
			$(bLast).click(function(){
				settings.currentPage = pages;
				update();
			});

			
			function update() {
				var from = ((settings.currentPage - 1) * settings.perPage) + 1;
				var to = from + settings.perPage - 1;

				if (to > $rows.length) {
					to = $rows.length;
				}

				$rows.hide();
				$rows.slice((from-1), to).show();

				of.innerHTML = from + ' to ' + to + ' of ' + $rows.length + ' entries';

				if ($rows.length <= settings.perPage) {
					$(container).hide();
				} else {
					$(container).show();
				}
			}
		});

	}

}(jQuery));
