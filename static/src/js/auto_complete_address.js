var placeSearch, autocomplete;
var geocoder, map ,marker;
var componentForm = {
    postal_code: 'short_name',
};

function initAutocomplete() {
	var el1 = document.getElementById('autocomplete_address');
	var el2 = document.getElementById('autocomplete_name');
	var el3 = document.getElementById('city_customer');
	var el4 = document.getElementById('postal_code');
	var el5 = document.getElementById('map_search');
	var el6 = document.getElementById('search_map_box_popup');
	if((el1 || el2 || el3 || el4 || el5 || el6) && navigator.onLine){
		if(document.activeElement && document.activeElement.id == "autocomplete_name" ) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('autocomplete_name')),{types: ['geocode']});
	    	autocomplete.addListener('place_changed', fillInAddress);
		} else if((document.activeElement && document.activeElement.id == "autocomplete_address")) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('autocomplete_address')),{types: ['geocode']});
	    	autocomplete.addListener('place_changed', fillInAddress);
		} else if((document.activeElement && document.activeElement.id == "city_customer")) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('city_customer')),{types: ['geocode']});
	    	autocomplete.addListener('place_changed', fillInAddress);
		} else if((document.activeElement && document.activeElement.id == "postal_code")) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('postal_code')),{types: ['geocode']});
	    	autocomplete.addListener('place_changed', fillInAddress);
		} else if((document.activeElement && document.activeElement.id == "map_search")) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('map_search')),{types: ['geocode']});
			var place = autocomplete.getPlace();
			autocomplete.addListener('place_changed', fillInAddress);
		} else if((document.activeElement && document.activeElement.id == "search_map_box_popup")) {
			autocomplete = new google.maps.places.Autocomplete((document.getElementById('search_map_box_popup')),{types: ['geocode']});
			autocomplete.addListener('place_changed', fillInAddress);
		}
	}
  }

function initMap() {
	var el1 = document.getElementById('map_view_edit_details');
    if(el1){
    	if(navigator.onLine && google){
    		var infowindow = new google.maps.InfoWindow({
        		size: new google.maps.Size(150, 50)
        	});
        	geocoder = new google.maps.Geocoder();
            var latlng = new google.maps.LatLng(-34.397, 150.644);
            var mapOptions = {
              zoom: 8,
              center: latlng
            }
            map = new google.maps.Map(el1, mapOptions);
            google.maps.event.addListener(map, 'click', function() {
                infowindow.close();
            });
    	} 
    }
}

function initpopupMap() {
    var el2 = document.getElementById('map_view_popup');
    if(el2){
    	if(navigator.onLine){
    		geocoder = new google.maps.Geocoder();
            var latlng = new google.maps.LatLng(-34.397, 150.644);
            var mapOptions = {
              zoom: 8,
              center: latlng
            }
            map = new google.maps.Map(el2, mapOptions);
    	}
    } 
}

function geocodePosition(pos) {
	var infowindow = new google.maps.InfoWindow({
		size: new google.maps.Size(150, 50)
	});
	geocoder.geocode({
	    latLng: pos
	}, function(responses) {
	    if (responses && responses.length > 0) {
	    	fillInAddress(responses);
	      marker.formatted_address = responses[0].formatted_address;
	    } else {
	      marker.formatted_address = 'Cannot determine address at this location.';
	    }
	    infowindow.setContent(marker.formatted_address + "<br>coordinates: " + marker.getPosition().toUrlValue(6));
	    infowindow.open(map, marker);
	});
}

function codeAddress(address) {
	if(navigator.onLine){
		var infowindow = new google.maps.InfoWindow({
			size: new google.maps.Size(150, 50)
		});
		if(address){
			if(geocoder){
				geocoder.geocode( {'address': address}, function(results, status) {
					if (status == 'OK') {
					$('#map_error_msg').hide();
		            map.setCenter(results[0].geometry.location);
		            if (marker) {
		                marker.setMap(null);
		                if (infowindow){
		                	infowindow.close();
		                }
		            }
		            marker = new google.maps.Marker({
		                map: map,
		                position: results[0].geometry.location,
		                draggable:true,
		            });
		            google.maps.event.addListener(marker, 'dragend', function() {
		                geocodePosition(marker.getPosition());
		              });
		            google.maps.event.addListener(marker, 'click', function() {
		                if (marker.formatted_address) {
		                	infowindow.setContent(marker.formatted_address + "<br>coordinates: " + marker.getPosition().toUrlValue(6));
		                } else {
		                	infowindow.setContent(address + "<br>coordinates: " + marker.getPosition().toUrlValue(6));
		                }
		                infowindow.open(map, marker);
		            });
		              google.maps.event.trigger(marker, 'click');
		          } else if(status != 'REQUEST_DENIED'){
		        	  $('#map_error_msg').show();
		          }
		        });
			}
		}
	}
}

function fillInAddress(dragend_address=null) {
    // Get the place details from the autocomplete object.
	if(dragend_address && dragend_address.length > 0){
    	for (var component in componentForm) {
    		if(document.getElementById(component)){
    			document.getElementById(component).value = '';
                document.getElementById(component).disabled = false;
    		}
        }
        // Get each component of the address from the place details
        // and fill the corresponding field on the form.
        var street_customer = "";
    	var city_customer = "";	
    	var country_customer = "";
    	var state_customer = "";
    	var popup_search_box = "";
    	if(dragend_address[0].address_components){
        	for (var i = 0; i < dragend_address[0].address_components.length; i++) {
        		popup_search_box += (' '+dragend_address[0].address_components[i].long_name);
                var addressType = dragend_address[0].address_components[i].types[0];
                if (componentForm[addressType]) {
                	var val = dragend_address[0].address_components[i][componentForm[addressType]];
                	if(document.getElementById(addressType)){
                		document.getElementById(addressType).value = val;
                	}
                } else {
                	if(addressType=='street_number' || addressType=='premise' || addressType=='sublocality_level_1' || addressType=='route' || addressType=='neighborhood' || addressType=='sublocality_level_3'
	                		|| addressType=='sublocality' || addressType=='political' || addressType=='sublocality_level_2' || addressType=='sublocality'){
                		street_customer += (' ' + dragend_address[0].address_components[i].long_name);
                	} else if(addressType=='administrative_area_level_1' || addressType=='administrative_area_level_2' || addressType=='postal_town'){
                		if(addressType=='administrative_area_level_2'){
                			city_customer += (' '+dragend_address[0].address_components[i].long_name);
                		} else{
                			city_customer += (' '+dragend_address[0].address_components[i].long_name);
                		}
                	} else if(addressType=='country'){
                		$.getJSON("/web/dataset/get_country",{'country_code':dragend_address[0].address_components[i].short_name}, function(result){
                			if(result){
                				if(document.getElementById('country_customer')){
                					document.getElementById('country_customer').value = result[0].id;
                				}
                			}
            			});
                	}
                }
            }
    	}
    	if(document.getElementById('autocomplete_address') && document.getElementById('city_customer')){
    		document.getElementById('autocomplete_address').value = street_customer;
        	document.getElementById('city_customer').value = city_customer;
    	}
    	if(document.getElementById('search_map_box_popup')){
    		document.getElementById('search_map_box_popup').value = popup_search_box;
    	}
	} else{
		var place = autocomplete.getPlace();
	    if(place){
	    	codeAddress(place.formatted_address);
	    	for (var component in componentForm) {
	    		if(document.getElementById(component)){
	    			document.getElementById(component).value = '';
	                document.getElementById(component).disabled = false;
	    		}
	        }
	        // Get each component of the address from the place details
	        // and fill the corresponding field on the form.
	        var street_customer = "";
	    	var city_customer = "";	
	    	var country_customer = "";
	    	var state_customer = "";
	    	var popup_search_box = "";
	    	if(place.address_components){
	        	for (var i = 0; i < place.address_components.length; i++) {
	        		popup_search_box += (' ' + place.address_components[i].long_name);
	                var addressType = place.address_components[i].types[0];
	                if (componentForm[addressType]) {
	                	var val = place.address_components[i][componentForm[addressType]];
	                	if(document.getElementById(addressType)){
	                		document.getElementById(addressType).value = val;
	                	}
	                } else {
	                	if(addressType=='street_number' || addressType=='premise' || addressType=='sublocality_level_1' || addressType=='route' || addressType=='neighborhood' || addressType=='sublocality_level_3'
	                		|| addressType=='sublocality' || addressType=='political' || addressType=='sublocality_level_2' || addressType=='sublocality'){
	                		street_customer += (' ' + place.address_components[i].long_name);
	                	} else if(addressType=='administrative_area_level_1' || addressType=='administrative_area_level_2' || addressType=='postal_town'){
	                		if(addressType=='administrative_area_level_2'){
	                			city_customer += (' '+place.address_components[i].long_name);
	                		} else{
	                			city_customer += (' '+place.address_components[i].long_name);
	                		}
	                	} else if(addressType=='country'){
	                		$.getJSON("/web/dataset/get_country",{'country_code':place.address_components[i].short_name}, function(result){
	                			if(result){
	                				if(document.getElementById('country_customer')){
	                					document.getElementById('country_customer').value = result[0].id;
	                				}
	                			}
	            			});
	                	}
	                }
	            }
	    	}
	    	if(document.getElementById('autocomplete_address') && document.getElementById('city_customer')){
	    		document.getElementById('autocomplete_address').value = street_customer;
	        	document.getElementById('city_customer').value = city_customer;
	    	}
	    	if(document.getElementById('search_map_box_popup')){
	    		document.getElementById('search_map_box_popup').value = popup_search_box;
	    	}
	    }
    }
}

function geolocate() {
	initAutocomplete();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var geolocation = {
	            lat: position.coords.latitude,
	            lng: position.coords.longitude
            };
            var circle = new google.maps.Circle({
            	center: geolocation,
            	radius: position.coords.accuracy
            });
            autocomplete.setBounds(circle.getBounds());
        });
    }
}
