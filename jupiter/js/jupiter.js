// ...
// Based on 
// Created by Bjorn Sandvik - thematicmapping.org

(function () {

	var mapFiles = [
		'color_map_canvas_grs.jpg',	
		'color_map_peach_2016.jpg',	
		'color_map_cassini_2000.jpg',
		'color_map_hst_2015.jpg',
		'color_map_voyager_2001.jpg',
	];


	var webglEl = document.getElementById('webgl');
	if (!Detector.webgl) {
		Detector.addGetWebGLMessage(webglEl);
		return;
	}

	window.addEventListener( 'resize', onWindowResize, false );

	var width  = document.documentElement.clientWidth,
		height = document.documentElement.clientHeight;

	// Globe params
	var radius   = 0.5,
		segments = 32,
		rotation = 6;  

	var options = {
		animate: false,
		mirror:  false,
		mapFile: 'color_map_canvas_grs.jpg',
		cameraDist: 7,
		sunPlaneDist: 60,
	};

	grs = {
		refDate: null,
		refLon: null,
		drift: null,
		lon: null
	}


	scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(15, width/height, 0.01, 500);
	camera.position.x = options.cameraDist;
	console.log(camera);

	var renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x222222));

	//var light = new THREE.DirectionalLight(0xffffff, 1);
	var light = new THREE.PointLight(0xffffff, 1, 1000, 0.5);
	light.position.set(0,0,options.sunPlaneDist);
	camera.add(light);
	scene.add(camera);

    var globe = createGlobe(radius, segments);
	globe.rotation.y = rotation; 
	scene.add(globe);

    //var labels = createLabels(radius*1.02, segments);
	//labels.rotation.y = rotation;
	//scene.add(labels);


	var stars = createStars(400, 64);
	scene.add(stars);
	console.log(scene);

	console.log("loading ephemeris file");

	ephem = null;
	$.getJSON('js/ephem.json')
	.done(function(data) { 
		console.log("done"); 
		ephem = data;
		console.log("testing ephem lookup:  ");
		console.log(data["2020-01-01 06:00"][0]); // test		
	})
	.fail(function(jqXHR, textStatus, errorThrown) {
		console.log("error " + textStatus);
		console.log("incoming Text " + jqXHR.responseText);
	})

 
	var controls = new THREE.TrackballControls(camera, renderer.domElement);


	webglEl.appendChild(renderer.domElement);

	var ephemQueryNowFcn = { add:function(){ showNow() }};
	var ephemQueryUtcFcn = { add:function(){ showSpecificTime()  }};


	var gui = new dat.GUI();
	gui.add(light.position, 'x', -90, 90).listen().name("sun az");
	gui.add(light.position, 'y', -15, 15).listen().name("sun el");
	gui.add(globe.rotation, 'y', 0, 6.2832).listen().name("planet rotation").onChange(function(val){  /*labels.rotation.y=val*/});
	gui.add(options, 'animate').listen();
	gui.add(options, 'mirror').listen().onChange(function(boolMirror){ setMirroring(boolMirror) });
	//gui.add(labels.material, 'opacity',0,1).listen().name("labels opacity");
	gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
	//gui.add(globe.material, 'bumpScale',0,0.1).listen().name("texture scale");
	gui.add(globe.material.color, 'r',0.6,1).listen().name("red");
	gui.add(globe.material.color, 'g',0.6,1).listen().name("green");
	gui.add(globe.material.color, 'b',0.6,1).listen().name("blue");
	gui.add(ephemQueryNowFcn,'add').name("Show now");
	gui.add(ephemQueryUtcFcn,'add').name("Show specific time");
	//gui.add(camera.rotation, '


	render();


	console.log("getting Jmess.dat");
	latestGrsInfo=null;
	getGrsData();




	function showNow(){
		console.log("ephemQueryNowFcn");
		var dateQuery = new Date();
		console.log("Time now:  " + dateQuery);
		getEphem(dateQuery);
	}

	function showSpecificTime(){
		console.log("ephemQueryUtcFcn");
		strResponse = window.prompt("UTC time  (YYYY-MM-DD HH:MM):");
		console.log("Time input dialog response:  " + strResponse);

		// handle empty response (cancel)
		if(strResponse == null){
			console.log("empty response");
			return;
		}

		// if received a response, then make sure user input meets required format:
		if(! (new RegExp('202[0-5]-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}').test(strResponse) )){
			alert("Error, invalid format");
			return;
		}
		
		// convert to date object:
		var dateQuery = new Date(strResponse.replace(' ','T') + ":00Z") || 0;
		if(dateQuery>0){
			console.log("query time:  " + dateQuery.toISOString());
			getEphem(dateQuery);
		} else {
			console.log("error, invalid date");
		}
	}
	
	function getEphem(dateQuery){
		var strQueryDate = dateQuery.toISOString().substring(0,10);
		var dayFrac = (dateQuery.getTime()/1000/60/60/24) % 1;
		console.log(strQueryDate + ' ' + dayFrac*24 + ' hours');

		// round down to 1/4 day:
		var hourRoundedDown = Math.floor(dayFrac*4)*6;
		var strDateInterpBelow = strQueryDate + " " + (hourRoundedDown<10?"0":"") + hourRoundedDown + ":00";
		console.log("strDateInterpBelow: " + strDateInterpBelow);
		var interpRatio = (dayFrac*24 % 6) / 6;
		console.log("interp ratio: " + interpRatio);
		
		// get interp upper bound:
		var strDateInterpAbove = new Date(new Date(strDateInterpBelow.replace(" ","T") + ":00Z").valueOf() + 6*60*60*1000).toISOString().substring(0,16).replace(/T/g, " ");
		console.log("interp bounds:  " + strDateInterpBelow + ", " + strDateInterpAbove);

		// get entries before and after query time:
		// fixme:  handle lookup errors
		var ephemBelow = ephem[strDateInterpBelow][0];
		console.log(ephemBelow);
		var ephemAbove = ephem[strDateInterpAbove][0];
		console.log(ephemAbove);
		
		// interpolate sub-observer longitude and rotate Mars to point that toward camera:
		var ObsSubLon = (ephemBelow.ObsSubLon + interpRatio*(ephemAbove.ObsSubLon - ephemBelow.ObsSubLon + (ephemAbove.ObsSubLon<ephemBelow.ObsSubLon?360:0) ) ) % 360;
		console.log(ObsSubLon);
		globe.rotation.y  = (ObsSubLon - grs.lon -90)*Math.PI/180;
		//labels.rotation.y = ObsSubLon*Math.PI/180;
		
		// interpolate sub-observer latitude and tilt camera to that orientation:
		var ObsSubLat = (ephemBelow.ObsSubLat + interpRatio*(ephemAbove.ObsSubLat - ephemBelow.ObsSubLat));
		console.log(ObsSubLat);
		camera.position = new THREE.Vector3(options.cameraDist*Math.cos(ObsSubLat*Math.PI/180), options.cameraDist*Math.sin(ObsSubLat*Math.PI/180), 0);
		
		// interpolate sub-sun point
		var SunSubLon = (ephemBelow.SunSubLon + interpRatio*(ephemAbove.SunSubLon - ephemBelow.SunSubLon + (ephemAbove.SunSubLon<ephemBelow.SunSubLon?360:0) )) % 360;
		console.log(ObsSubLon);
		var SunSubLat = (ephemBelow.SunSubLat + interpRatio*(ephemAbove.SunSubLat - ephemBelow.SunSubLat));
		console.log(SunSubLat);
		
		// move light source (in camera frame) according to interpolated sun direction
		var deltaLonEarthSun = ObsSubLon - SunSubLon;
		console.log(deltaLonEarthSun);
		var deltaLatEarthSun = ObsSubLat - SunSubLat;
		console.log(deltaLatEarthSun);
		var camPosX = 2*options.sunPlaneDist*Math.sin(deltaLonEarthSun*Math.PI/180);
		console.log(camPosX);
		var camPosY = -2*options.sunPlaneDist*Math.sin(deltaLatEarthSun*Math.PI/180);
		console.log(camPosY);
		light.position.set(camPosX, camPosY, options.sunPlaneDist);

	}
	
	function renderEphemeris(ephemText){
		console.log("Received ephemeris:");
		console.log(ephemText);
	}


	function getGrsData(){
		$(function() {
		  $.ajax({
			url: "https://cors-anywhere.herokuapp.com/www.grischa-hahn.homepage.t-online.de/astro/winjupos/Jmess.dat",
			//url: "http://127.0.0.1:8887/jupiter/Jmess.dat",
			type: "GET",
			dataType: "text",
			contentType: "text/plain",
			headers: { "X-Requested-With": "XMLHttpRequest" },
			success: function(result) {
				console.log("received Jmess.dat");
				console.log(result);
				lastline=null;
				result.split('\n').forEach(function(line){
					if((/ rs *e3/).test(line)) 
						lastline=line;
				});
				if(lastline==null){
					console.log("failed to find GRS data in Jmess.dat");
					return;
				}
				latestGrsInfo = lastline.split(/ +/);
				grs.refDateStr = latestGrsInfo[5];
				grs.refLon = latestGrsInfo[6];
				grs.drift = latestGrsInfo[8];
				var refDate = new Date([grs.refDateStr.slice(0,4), grs.refDateStr.slice(4,6), grs.refDateStr.slice(6,8)].join("-"));
				daysSince = (new Date() - refDate)/1000/86000;
				grs.lon = (grs.refLon*1 + grs.drift*1 * daysSince) % 360;
				
				
			},
			error: function(error) {
			  console.log(`Error ${error}`)
			},
		  });
		});
	}
	


	function changeMap(){
		console.log("changing base map to: images/" + options.mapFile);
		globe.material.map = THREE.ImageUtils.loadTexture('images/' + options.mapFile);
		
		if(options.mirror){
			reverseTexture();
		}
	}
	
	function setMirroring(boolMirror){
		if(boolMirror){
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels_inv.png');
			webglEl.style.transform = "scaleX(-1)";
		} else {
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels.png');
			webglEl.style.transform = "scaleX(1)";
		}
	}

	function render() {
		controls.update();
		if(options.animate) {
			globe.rotation.y += 0.0005;
			//labels.rotation.y += 0.0005;
		}
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}

	function createGlobe(radius, segments) {
		console.log("making globe");
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments),
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('images/' + options.mapFile),
				//bumpMap:     THREE.ImageUtils.loadTexture('images/mars_bump_map_4k_adj.jpg'),
				//bumpScale:   0.01,
				side:        THREE.DoubleSide,
				shininess:   5,
			})
		);
	}
	
	function createLabels(radius, segments) {
		console.log("making labels");
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments),
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('images/labels.png'),
				transparent: true,
				opacity:     0.5,
				side:        THREE.DoubleSide,
			})
		);
	}

	function createStars(radius, segments) {
		console.log("making stars");		
		var starTexture = new THREE.ImageUtils.loadTexture( 'images/starfield.jpg' );	
		starTexture.wrapS = THREE.RepeatWrapping;
		starTexture.wrapT = THREE.RepeatWrapping;
		starTexture.repeat.set(4,4);
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments), 
			new THREE.MeshBasicMaterial({
				map:	starTexture,
				side: THREE.BackSide
			})
		);

	}


	function onWindowResize(){
		width = document.documentElement.clientWidth;
		height = document.documentElement.clientHeight;
		console.log("resizing to " + width + " x " + height + " px");
		camera.aspect = document.documentElement.clientWidth / document.documentElement.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}

}());