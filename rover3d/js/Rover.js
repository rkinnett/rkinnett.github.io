import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';


let rover = {};


let TWO_PI = 2*Math.PI;
let deg2rad = Math.PI/180;
let rad2deg = 180/Math.PI;

rover.attitude = {roll: 0, pitch: 0, yaw: 0};

rover.jointGroupNames = ["arm", "rsm", "hga", "mob", "wheels"];
rover.jointGroupLongNames = {arm: "Robotic Arm", rsm: "Remote Sensing Mast", hga: "High-Gain Antenna", mob: "Suspension"};

rover.joints = {
  arm: {
    az:     {name: "Azimuth",   model_obj_name: "arm_az",     axis: "z",  dir: 1,  angle: 0.1,  min:-180,  max:180},
    el:     {name: "Elevation", model_obj_name: "arm_el",     axis: "y",  dir:-1,  angle: 0.1,  min:-180,  max:180},
    elbow:  {name: "Elbow",     model_obj_name: "arm_elbow",  axis: "y",  dir:-1,  angle: 0.1,  min:-180,  max:180},
    wrist:  {name: "Wrist",     model_obj_name: "arm_wrist",  axis: "y",  dir:-1,  angle: 0.1,  min:-10,   max:210},
    turret: {name: "Turret",    model_obj_name: "arm_turret", axis: "z",  dir: 1,  angle: 0.1,  min:-10,   max:370},
  },

  rsm: {
    az:     {name: "Azimuth",   model_obj_name: "rsm_az",     axis: "z",  dir: 1,  angle: 0.1,  min:-185,  max:185 },
    el:     {name: "Elevation", model_obj_name: "rsm_el",     axis: "y",  dir: 1,  angle: 0.1,  min:-87,   max:91 },
  },

  hga: {
    az:     {name: "Azimuth",   model_obj_name: "hga_az",     axis: "z",  dir: 1,  angle: 0.1,  min:-185,  max:185 },
    el:     {name: "Elevation", model_obj_name: "hga_el",     axis: "y",  dir: 1,  angle: 0.1,  min:0,     max:180 },
  },

  mob: {
    steer_rf:  {name: "Steer Right-Front",   model_obj_name: "suspension_strut_RF",     axis: "z",  dir:-1,  angle: 0.1,  min:-90,  max:90 },
    steer_rr:  {name: "Steer Right-Rear",    model_obj_name: "suspension_strut_RR",     axis: "z",  dir:-1,  angle: 0.1,  min:-90,  max:90 },
    steer_lf:  {name: "Steer Left-Front",    model_obj_name: "suspension_strut_LF",     axis: "z",  dir:-1,  angle: 0.1,  min:-90,  max:90 },
    steer_lr:  {name: "Steer Left-Rear",     model_obj_name: "suspension_strut_LR",     axis: "z",  dir:-1,  angle: 0.1,  min:-90,  max:90 },
    diff:      {name: "Rocker Differential", model_obj_name: "suspension_diff",         axis: "z",  dir: 1,  angle: 0.1,  min:-8,   max:8  },
    bogie_left: {name: "Bogie Left",         model_obj_name: "suspension_bogie_left",   axis: "y",  dir: 1,  angle: 0.1,  min:-40,   max:40  },
    bogie_right: {name: "Bogie Right",       model_obj_name: "suspension_bogie_right",  axis: "y",  dir: 1,  angle: 0.1,  min:-40,   max:40  },
  },

  wheels: {
    lf:   {name: "Wheel Left-Front",   model_obj_name: "wheel_LF",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
    lm:   {name: "Wheel Left-Mid",     model_obj_name: "wheel_LM",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
    lr:   {name: "Wheel Left-Rear",    model_obj_name: "wheel_LR",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
    rf:   {name: "Wheel Right-Front",  model_obj_name: "wheel_RF",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
    rm:   {name: "Wheel Right-Mid",    model_obj_name: "wheel_RM",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
    rr:   {name: "Wheel Right-Rear",   model_obj_name: "wheel_RR",  axis: "y",  dir:-1,  angle: 0,  min:-360,  max:360 },
  },
};


// factor the joint names:
rover.jointNames = {arm:[], rsm:[], hga:[], mob:[], wheels:[]};
rover.jointGroupNames.forEach(function(jointGroupName){
for(var jointName in rover.joints[jointGroupName]) { 
  //console.log(jointNames);
  rover.jointNames[jointGroupName].push(jointName);
}
});

// Define canonical poses:
rover.poses = {
  arm: {
    STOW:          [ 1.5721, -0.2778, -2.8163,  3.1211,  1.5708],
    READY_OUT:     [ 0.0000, -1.5708,  1.5708,  0.0000,  3.1416],
    READY_IN:      [-3.1416, -1.5708, -1.5708,  3.1416,  0.0000],
    DECK_READY:    [-0.1586, -1.1120, -1.2482,  0.7949,  0.0458],
    BIT_BOX:       [-1.4525, -1.9292, -1.3844,  0.1139,  1.2716],
    DRILL_SIEUWU:  [-2.4740, -2.3378, -2.1335,  2.9149,  0.0000],
    DRILL_SOEUWU:  [ 0.3863, -0.7034,  2.2250,  3.1873, -0.0405],
    DRILL_SOEUWD:  [ 0.3863, -0.4309,  2.0207,  0.0000,  3.1180],
    PIXL_SIEUWU:   [-2.4740, -2.3378, -2.4059,  3.1873,  4.6995],
    PIXL_SOEUWD:   [ 0.0458, -0.2266,  1.8164,  0.0000,  1.6084],
    ZERO:          [ 0, 0, 0, 0, 0],
  },
  rsm: {
    STOW:          [-2.09, -1],
    STRAIGHT:      [0, 0],
    WORKSPACE:     [-0.5, -0.8],
    DRIVE_FWD:     [ 0.0, -0.6],
    DRIVE_STBD:    [ 0.7, -0.6],
  },
  hga: {
    STOW:          [-1.05, 1.5708],
    READY:         [0, 0.5],
  },
  mob: {
    STRAIGHT:       [0, 0, 0, 0,    0, 0, 0, 0, 0],
    TURN_IN_PLACE:  [0.785, -0.785, -0.785, 0.785,    0, 0, 0, 0, 0],
    TURN_RIGHT:     [-0.785, 0.785, -0.785, 0.785,    0, 0, 0, 0, 0],
    TURN_LEFT:      [0.785, -0.785, 0.785, -0.785,    0, 0, 0, 0, 0],
  },
};
    
// factor the poses:
rover.poseNames = {arm:[], rsm:[], hga:[], mob:[]};
rover.jointGroupNames.forEach(function(jointGroupName){
  for(var poseName in rover.poses[jointGroupName]) rover.poseNames[jointGroupName].push(poseName);
});



rover.arm = {
  moving: false,
  goal:   rover.poses.arm.STOW.slice(),  //rad
  rate:   [0, 0, 0, 0, 0],  //rad/sec
  dir:    [0, 0, 0, 0, 0],  //sign (1, -1)
  initialPos: [],
  maxRate: 20, //deg/sec
  sequence: [],
  stowed:  true,
}


rover.audio = {
  listener:   null,
  maxVol:     1,
  fadeGain:   0,
  fadeRate:   5, //per sec
  drive:      null,
  armBrake:   null,
  arm:        null,
  refDist:    2,  //m
  maxDist:    20, //m
  started:    false,
  loaded: {
    arm:      false,
    armBrake: false,
    drive:    false,
  }
}


rover.wheels = {
  lf: {x:  1.18,  y: -1.06},
  lm: {x:  0.00,  y: -1.18},
  lr: {x: -1.08,  y: -1.06},
  rf: {x:  1.18,  y:  1.06},
  rm: {x:  0.00,  y:  1.18},
  rr: {x: -1.08,  y:  1.06},
}

rover.drive = {
  driving:         false,
  prevDriving:     false,
  rnavSpeed:       0,
  rnavSpeedRatio:  1,
  maxSpeed:        0.042, //m/sec
  maxSpeedRatio:   8,     // x actual max rover speed (maxSpeed)
  speedRatioIncr:  1,     // x actual rover speed
  speedRatio:      0,
  headingRate:     0,     //deg/sec
  headingChange:   0,
  arcLength:       0,
  turnRadius:      0,
  turnRate:        0,     //deg/meter
  turnRateIncr:    30,    //deg/meter
  wheelSpeed:      {lf: 0, lm: 0, lr: 0, rf: 0, rm: 0, rr: 0}, //rad/sec
  wheelSpeedRatio: {lf: 1, lm: 1, lr: 1, rf: 1, rm: 1, rr: 1},
  nextPosRnav:     new THREE.Vector3(0,0,0),
  surface:         null,
}


const raycaster = new THREE.Raycaster(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1), 0.1, 2000);



///////////////////////////  CORE FUNCTIONS  //////////////////////////////


rover.load = function(modelUrl, vecRoverUp, vecRoverFwd, onload){
  vecRoverUp.normalize();
  vecRoverFwd.normalize();
  const vecRoverRight = vecRoverFwd.clone().cross(vecRoverUp).normalize();
  
  rover.axes = {};
  rover.axes.forward  = vecRoverFwd;
  rover.axes.up       = vecRoverUp;
  rover.axes.right    = vecRoverRight;
  
  rover.axes.roll   = rover.axes.forward;
  rover.axes.pitch  = rover.axes.right;
  rover.axes.yaw    = vecRoverUp.clone().multiplyScalar(-1);
  
  const loader = new GLTFLoader();//.setPath( '../rover3d/model/' );   
  loader.load(modelUrl, function ( gltf ) {
    rover.model = gltf.scene;
    rover.model.name = "Rover";
    rover.parts = {};
    
    rover.model.traverse( function ( child ) {
      child.castShadow = true;
      child.receiveShadow = true;
      rover.parts[child.name] = child;
   
      // Check if this is a named joint:
      for(var jointGroupName of rover.jointGroupNames){
        for(var jointName of rover.jointNames[jointGroupName]){
          if(child.name == rover.joints[jointGroupName][jointName].model_obj_name){
            //console.log("found " + child.name);
            //console.log(child);
            rover.joints[jointGroupName][jointName].obj = child;
            break;
          }
        }
      }
       
      // Make single-sided to avoid rendering artifacts:
      if ( child.isMesh ) {
        child.material.side = THREE.FrontSide;
        if(child.material.map){
          child.material.minFilter = THREE.NearestMipmapLinearFilter;
        }
        child.material.needsUpdate = true;
      }
    } );

    rover.model.children[0].applyQuaternion( new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), vecRoverUp) );    
    rover.model.children[0].applyQuaternion( new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vecRoverFwd) );    
    
    if(onload) onload();
  } );
}


rover.update = function(secondsElapsed){ 
  if(rover.drive.driving) rover.drive.update(secondsElapsed);
  
  if(rover.arm.moving) rover.arm.update(secondsElapsed);

  if(rover.audio.started && (rover.audio.arm.state!="stopped" || rover.audio.drive.state!="stopped")){
    rover.audio.update(secondsElapsed);
  }
}





//////////////////////  GENERAL ARTICULATION  /////////////////////

rover.goToPose = function(jointGroup, poseName){
  //console.log("Go to " + jointGroup + " pose: " + poseName);
  var joints = rover.poses[jointGroup][poseName].map(function(angle){return angle*rad2deg});
  //console.log("joints: " + joints);
  rover.setJoints(jointGroup, joints);
  if(jointGroup == "mob") rover.mobSetRockers(0);
}

rover.setJoints = function(jointGroup, jointAngles){
  //console.log("joint group " + jointGroup);
  var n = 0;
  //console.log(jointNames);
  rover.jointNames[jointGroup].forEach(function(jointName){
    rover.setJoint(jointGroup, jointName, jointAngles[n++]);
  });
  //requestRenderIfNotRequested();
}

rover.setJoint = function(jointGroupName, jointName, angle){
  //console.log(jointGroupName + ", joint " + jointName + ", angle " + angle);
  var joint = rover.joints[jointGroupName][jointName];
  //console.log(joint);
  joint.angle = angle;
  joint.obj.rotation[joint.axis] = joint.dir*angle*deg2rad;
}

rover.mobSetRockers = function(diffAngle){
  rover.setJoint("mob", "diff", diffAngle); 
  var rocker_angle = diffAngle*2.2 * deg2rad;
  rover.parts.suspension_rocker_right.rotation.y = rocker_angle;
  rover.parts.suspension_rocker_left.rotation.y = -1*rocker_angle;
  rover.parts.suspension_diff_link_right.rotation.y = -1*rocker_angle;
  rover.parts.suspension_diff_link_left.rotation.y = rocker_angle;
  //requestRenderIfNotRequested();
}





//////////////////////////  ARM STUFF  /////////////////////////////////


rover.arm.planSequence = function(toPose){
  console.log("planning arm sequence to pose: " + toPose);
  //var toPose = options.pose.arm;
  const fromPoseShoulderState = rover.joints.arm.az.angle>-90? "OUT" : "IN";
  const toPoseShoulderState = /(STOW)|(READY_OUT)|(DECK_READY)|(.*_SO)|(ZERO)/.test(toPose) ? "OUT" : "IN";

  rover.arm.sequence = [];

  if(rover.arm.stowed){
    rover.arm.sequence.push("ONEJOINT:5:105");  // just a guess
    rover.arm.sequence.push("ONEJOINT:3:-155");
    rover.arm.sequence.push("ONEJOINT:1:75");
    rover.arm.sequence.push("READY_OUT");
  }
  
  // If the shoulder state of the goal pose is opposite of initial shoulder state,
  // then move to READY_* corresponding to the initial pose, then flip.
  console.log([toPose, fromPoseShoulderState, toPoseShoulderState]);
  if(fromPoseShoulderState=="OUT" && toPoseShoulderState=="IN"){
    rover.arm.sequence.push("READY_OUT");
    rover.arm.sequence.push("READY_IN");
  } else if(fromPoseShoulderState=="IN" && toPoseShoulderState=="OUT"){
    rover.arm.sequence.push("READY_IN");
    rover.arm.sequence.push("READY_OUT");
  }

  if(toPose=="STOW"){
    rover.arm.sequence.push("READY_OUT");
    rover.arm.sequence.push("JOINTS:75,-16,-155,180,105");
    rover.arm.sequence.push("ONEJOINT:1:90");
    rover.arm.sequence.push("ONEJOINT:3:-161");
    rover.arm.sequence.push("ONEJOINT:5:90");
    //rover.arm.sequence.push("STOW");
  }

  if(rover.arm.sequence[rover.arm.sequence.length]!=toPose){ 
    rover.arm.sequence.push(toPose);
  }
  console.log(rover.arm.sequence);
  
  if(rover.arm.sequence.length){
    rover.arm.updateJointGoals();
    if(!rover.arm.moving){
      console.log("starting arm motion");
      rover.drive.speedRatio=0;
      rover.drive.setSpeed(); // stop driving

      setTimeout(function(){
        if(rover.audio.started && !rover.audio.armBrake.isPlaying) rover.audio.armBrake.play();
        
        setTimeout(function(){
          if(rover.audio.started && !rover.audio.arm.isPlaying) rover.audio.arm.state="starting";
          rover.arm.moving = true;
          //requestRenderIfNotRequested();
        }, 500); //delay milliseconds
      }, 200);
    }
  }
}


rover.arm.updateJointGoals = function(){
  if(rover.arm.sequence.length==0){
    rover.arm.moving = false;
    return;
  }
          
  const armCmd = rover.arm.sequence[0].split(/[:,]/);
  console.log("Arm command: " + armCmd);
  
  for(var j=0; j<5; j++){
    rover.arm.initialPos[j] = rover.joints.arm[rover.jointNames.arm[j]].angle*1;
  }
  
  switch(armCmd[0]){
    case "ONEJOINT":
      const jntIndex = armCmd[1]*1 - 1;  // convert from 1-index to 0-index
      console.log("updating arm goal, joint " + armCmd[1] + '(' + jntIndex + ') to ' + armCmd[2]);
      const goalPos = armCmd[2]*1;
      const distToGoal = goalPos - rover.arm.initialPos[jntIndex]*1;
      const dir = Math.sign(distToGoal);
      for(var j=0; j<5; j++){
        rover.arm.goal[j] = (jntIndex==j) ? goalPos : rover.arm.initialPos[j]*1;
        rover.arm.rate[j] = (jntIndex==j) ? dir*rover.arm.maxRate : 0;
        rover.arm.dir[j]  = (jntIndex==j) ? dir : 0;
      }
      break;
      
    case "JOINTS":
      console.log("updating arm goal, all joints");
      for(var j=0; j<5; j++){
        rover.arm.goal[j] = armCmd[1+j];
      }
      break;
      
    default:
      if(rover.poses.arm[armCmd[0]]){
        rover.arm.goal = rover.poses.arm[armCmd[0]].map(function(angle){return angle*rad2deg});
        console.log("updating arm goal to pose " + armCmd[0]);
        console.log(rover.arm.goal.toString());

      } else {
        console.log('updateArmJointGoals:  unrecongnized command: "' + rover.arm.sequence[0] + '"');
        return;
      }
  }
  
  if(armCmd[0]!="ONEJOINT"){
    // Check which joint has the furthest to go to get to its goal:
    // That joint will move at full speed while other joints move proportional to their distance to goal relative to the longest move.
    var longestDistToGoal = 0;
    var distToGoal = [];
    for(var j=0; j<5; j++){
      distToGoal[j] = rover.arm.goal[j] - rover.arm.initialPos[j];
      if(distToGoal[j]) console.log("joint " + j + " distance to goal: " + distToGoal[j]);
      //console.log([distToGoal[j], rover.arm.goal[j], rover.arm.initialPos[j]]);
      if(Math.abs(distToGoal[j])>longestDistToGoal) longestDistToGoal = Math.abs(distToGoal[j]);
    }
    console.log([distToGoal, longestDistToGoal, rover.arm.maxRate]);
    for(var j=0; j<5; j++){
      rover.arm.rate[j] = distToGoal[j]/longestDistToGoal * rover.arm.maxRate;
      rover.arm.dir[j] = Math.sign(rover.arm.rate[j]);
    }
  }
  console.log(JSON.parse(JSON.stringify(rover.arm)));
}


rover.arm.update = function(timeDelta){
  if(rover.arm.sequence.length==0){
    rover.arm.moving = false;
    return;
  }
          
  var nJointsReachedGoal = 0;
  const armCmd = rover.arm.sequence[0];
  
  for(var j=0; j<5; j++){
    if(rover.arm.rate[j]){
      const jointName = rover.jointNames.arm[j];
      const currentPos = rover.joints.arm[jointName].angle*1;
      var nextPos = currentPos + rover.arm.rate[j]*timeDelta;
      //console.log([j, rover.arm.dir[j], nextPos, rover.arm.goal[j], nJointsReachedGoal]);
      if( (rover.arm.dir[j]==1 && nextPos>rover.arm.goal[j])  ||  (rover.arm.dir[j]==-1 && nextPos<rover.arm.goal[j])  ){
        nextPos = rover.arm.goal[j];
        nJointsReachedGoal++;
        rover.arm.rate[j] = 0;
      }
      rover.joints.arm[jointName].angle = nextPos;
      rover.setJoint("arm", jointName, nextPos);
    } else nJointsReachedGoal++;
  }
  
  if(nJointsReachedGoal==5){
    console.log("Arm reached sequence goal");
    rover.arm.sequence.shift();
    console.log(JSON.parse(JSON.stringify(rover.arm)));
    rover.arm.moving = !(rover.arm.sequence.length==0);
    if(!rover.arm.moving){
      console.log("stopping arm motion");
      rover.arm.stowed = (armCmd=="STOW");
      setTimeout(function(){
        if(rover.audio.arm.isPlaying) rover.audio.arm.pause();
        setTimeout(function(){
          if(!rover.audio.armBrake.isPlaying) rover.audio.armBrake.play();
        }, 200);
      }, 300);
    } else {
      rover.arm.updateJointGoals();
    }
  }
}





/////////////////////////// AUDIO STUFF ///////////////////////////

rover.audio.load = function(audioFilePath, camera){
  if(audioFilePath==undefined || camera==undefined){
    console.log("Error, Rover.js, rover.audio.load:  audioFilePath or camera invalid or undefined");
    return;
  }
  
  // Set up audio listener (this is like a virtual microphone in the scene):
  rover.audio.listener = new THREE.AudioListener(),
  rover.audio.fadeGain = rover.audio.listener.context.createGain();  // additional gain control for smoothly starting/stopping
  camera.add(rover.audio.listener);
  rover.audio.started = true;
  
  console.log("loading audio files");
  const audioloader = new THREE.AudioLoader();

  rover.audio.drive = new THREE.PositionalAudio( rover.audio.listener ).setRefDistance( rover.audio.refDist ).setMaxDistance( rover.audio.maxDist ).setLoop(true);
  audioloader.load( audioFilePath + '/45857_FILTERED_HIGHLIGHTS_-_Sol16RoverDriveHighlights.mp3', function ( buffer ) {
    rover.audio.drive.setBuffer( buffer );
    rover.audio.loaded.drive = true;
    rover.audio.drive.state = "stopped";
    if(rover.model) rover.model.add(rover.audio.drive);
  });

  rover.audio.armBrake = new THREE.PositionalAudio( rover.audio.listener ).setRefDistance( rover.audio.refDist ).setMaxDistance( rover.audio.maxDist ).setLoop(false);
  audioloader.load( audioFilePath + '/brake_release.mp3', function ( buffer ) {
    rover.audio.armBrake.setBuffer( buffer );
    rover.audio.loaded.armBrake = true;
    rover.audio.armBrake.state = "stopped";
    if(rover.model) rover.joints.arm.elbow.obj.add(rover.audio.armBrake);
  });

  rover.audio.arm = new THREE.PositionalAudio( rover.audio.listener ).setRefDistance( rover.audio.refDist ).setMaxDistance( rover.audio.maxDist ).setLoop(true);
  audioloader.load( audioFilePath + '/arm_motors.mp3', function ( buffer ) {
    rover.audio.arm.setBuffer( buffer );
    rover.audio.loaded.arm = true;
    rover.audio.arm.state = "stopped";
    if(rover.model) rover.joints.arm.elbow.obj.add(rover.audio.arm);
  });
}   


rover.audio.update = function(timeElapsed){
  if(!rover.audio.started) {
    //rover.audio.load();
  } else {

    if(rover.model && rover.model.position) {
      //rover.audio.drive.panner.setPosition(rover.model.position.x, rover.model.position.y, rover.model.position.z);
      //rover.audio.armBrake.panner.setPosition(rover.model.position.x, rover.model.position.y, rover.model.position.z);
      //rover.audio.arm.panner.setPosition(rover.model.position.x, rover.model.position.y, rover.model.position.z);
    }

  
    //console.log("updating audio " + rover.audio.drive.state + " " + rover.audio.arm.state);
  
    if(rover.audio.drive.state=="starting"){
      if(!rover.audio.drive.isPlaying) {
        rover.audio.fadeGain.gain.value = 0;
        console.log("resuming drive audio");
        rover.audio.drive.play();
        //requestRenderIfNotRequested();
      } else {
        rover.audio.fadeGain.gain.value = Math.min(1, rover.audio.fadeGain.gain.value + rover.audio.fadeRate * timeElapsed);
        if(rover.audio.fadeGain.gain.value==1) {
          console.log("drive audio playing");
          rover.audio.drive.state = "playing";
        }
      }
      
    } else if(rover.audio.drive.state=="stopping"){
      console.log("drive audio stopping " + rover.audio.fadeGain.gain.value + " " + rover.audio.fadeRate + " " + timeElapsed);
      rover.audio.fadeGain.gain.value = Math.max(0, rover.audio.fadeGain.gain.value - rover.audio.fadeRate * timeElapsed);
      if(rover.audio.fadeGain.gain.value==0) {
        rover.audio.drive.state = "stopped";
        if(rover.audio.drive.isPlaying) {
          console.log("pausing drive audio");
          rover.audio.drive.pause();
        }
      } //else requestRenderIfNotRequested();
    } 
    
    if(rover.audio.arm.state=="starting"){
      if(!rover.audio.arm.isPlaying) {
        rover.audio.fadeGain.gain.value = 0;
        console.log("resuming arm audio");
        rover.audio.arm.play();
        //requestRenderIfNotRequested();
      } else {
        rover.audio.fadeGain.gain.value = Math.min(1, rover.audio.fadeGain.gain.value + rover.audio.fadeRate * timeElapsed);
        if(rover.audio.fadeGain.gain.value==1) {
          //console.log("playing arm audio " + rover.audio.fadeGain.gain.value);
          //console.log("arm audio reached full gain");
          rover.audio.arm.state = "playing";
          rover.audio.update(0);
        }
      }
      
    } else if(rover.audio.arm.state=="stopping"){
      rover.audio.fadeGain.gain.value = Math.max(0, rover.audio.fadeGain.gain.value - rover.audio.fadeRate * timeElapsed);
      if(rover.audio.fadeGain.gain.value==0) {
        rover.audio.arm.state = "stopped";
        if(rover.audio.arm.isPlaying) {
          console.log("pausing arm audio");
          rover.audio.arm.pause();
        }
      } //else requestRenderIfNotRequested();
    }
  }
}





////////////////////////// ATTITUDE STUFF //////////////////////

rover.attitude.settle = function(vecRoveUpNew, yaw){
  // Rotate rover to match local normal vector, preserving heading.
  // To preserve heading, the new rover-fwd vector must be in the vertical plane which contains the old rover-fwd vector and zenith.
  // The new rover-fwd vector must also exist in the plane orthogonal to the terrain normal vector.
  // Therefore the cross product between the normal vectors defining these two planes describes the
  // intersection of the two planes which includes the new rover-fwd vector.  
    
  rover.attitude.yaw = (yaw==undefined) ? rover.attitude.yaw : yaw;
  
  const clamp = function(number, min, max) {  return Math.max(min, Math.min(number, max)); }
  
  // Calculate azimuth vector (rover-fwd projected onto world-horizontal plane):
  const vecAzimuth = rover.axes.forward.clone().applyAxisAngle(rover.axes.yaw, rover.attitude.yaw);  

  // Define vertical "azimuth plane" in which rover-fwd must exist in order to meet yaw parameter:
  const vecHeadingPlaneNormal = new THREE.Vector3().crossVectors(vecAzimuth, rover.axes.up).normalize();

  // The new (tilted) rover-fwd direction lies in the intersection of the vertical azimuth plane and the plane normal to the tilted up vector:
  const vecRoverFwd_new = new THREE.Vector3().crossVectors(vecRoveUpNew, vecHeadingPlaneNormal).normalize();
  
  // Solve for new roll and pitch:
  const vecRoverUpZeroRoll  = new THREE.Vector3().crossVectors(vecHeadingPlaneNormal, vecRoverFwd_new).normalize(); // where rover-up would be if zero roll
  const rollsign = vecRoveUpNew.dot(vecHeadingPlaneNormal)>0? 1 : -1;
  rover.attitude.roll = Math.acos( clamp( vecRoverUpZeroRoll.dot(vecRoveUpNew), -1,1) ) *rollsign;
  
  const pitchsign = vecRoverFwd_new.dot(rover.axes.up)>0? 1 : -1;
  rover.attitude.pitch = Math.acos(clamp( vecAzimuth.dot(vecRoverFwd_new), -1,1)) *pitchsign;
    
  rover.attitude.set();
}

rover.attitude.set = function(eulerAngles){
  rover.attitude.roll  = (!eulerAngles || eulerAngles.roll==undefined)   ? rover.attitude.roll  : eulerAngles.roll;
  rover.attitude.pitch = (!eulerAngles || eulerAngles.pitch==undefined)  ? rover.attitude.pitch : eulerAngles.pitch;
  rover.attitude.yaw   = (!eulerAngles || eulerAngles.yaw==undefined)    ? rover.attitude.yaw   : eulerAngles.yaw;
  //console.log(newAttitude);
  rover.model.rotation.set(0,0,0,'XYZ');  
  rover.model.rotateOnAxis(rover.axes.yaw, rover.attitude.yaw);
  rover.model.rotateOnAxis(rover.axes.pitch, rover.attitude.pitch);
  rover.model.rotateOnAxis(rover.axes.roll, rover.attitude.roll);
  rover.model.updateMatrixWorld();
}

rover.attitude.projectToSurface = function(){
  if(rover.drive.surface){
    //const rnavRoverUp = rover.axes.up.clone();
    //const rnavRoverDown = rnavRoverUp.clone().multiplyScalar(-1);
    //const rot = new THREE.Matrix4().extractRotation( rover.model.matrix ); // get rover rotation matrix
    //const worldRoverUp = rnavRoverUp.clone().applyMatrix4(rot);
    //const worldRoverDown = rnavRoverDown.clone().applyMatrix4(rot);
    const worldRoverUp = rover.axes.up.clone().applyQuaternion(rover.model.quaternion);
    const worldRoverDown = worldRoverUp.clone().multiplyScalar(-1);
    //Starting from rover position, define a vector some distance "above the rover" (-rnavZ), then 
    //project a ray through the surface to get intersection, then place rover at intersection.
    //console.log(rot);
    //console.log(worldRoverUp);
    console.log(rover.model.position);
    const worldPointAboveRover = rover.model.position.clone().add(rover.drive.surface.parent.position).add( worldRoverUp.clone().multiplyScalar(100) );
    console.log(worldPointAboveRover);
    raycaster.set(worldPointAboveRover, worldRoverDown);
    var intersects = raycaster.intersectObjects(rover.drive.surface.children, true);
    console.log(intersects);
    if(intersects && intersects[0] && intersects[0].point){
      rover.model.position.copy(intersects[0].point).sub(rover.drive.surface.parent.position);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix( intersects[0].object.matrixWorld );        
      const nvec = intersects[0].face.normal.clone().applyMatrix3( normalMatrix ).normalize();  // normal vector to local terrain
      rover.attitude.settle(nvec);
    }
  }
}



////////////////////////// DRIVE STUFF ////////////////////////

rover.drive.straightenWheels = function(){
  rover.drive.turnRadius = Infinity;
  rover.setJoint("mob", "steer_lf", 0);
  rover.setJoint("mob", "steer_rf", 0);
  rover.setJoint("mob", "steer_lr", 0);
  rover.setJoint("mob", "steer_rr", 0);
  for(var wheel in rover.wheels){
    rover.drive.wheelSpeedRatio[wheel] = 1;
  }
  rover.drive.rnavSpeedRatio = 1;
  rover.drive.setSpeed();
}


rover.drive.setSteering = function(turnRate){      
  // force turn rate to follow increments between allowable range:
  rover.drive.turnRate = (turnRate!==undefined)? turnRate : rover.drive.turnRate;
  rover.drive.turnRate = Math.max(-180, Math.min(180, Math.round(rover.drive.turnRate/rover.drive.turnRateIncr)*rover.drive.turnRateIncr ));
  
  // play sound for 0.25 sec
  if(!rover.drive.driving && rover.audio.started) {
    if(!rover.audio.drive.isPlaying) {
      rover.audio.drive.state="starting";
    }
    setTimeout(function(){
      if(!rover.drive.driving && rover.audio.drive && rover.audio.drive.isPlaying) {
        rover.audio.drive.state="stopping";
      }
    },250);
  }
  
  if(turnRate==0){
    rover.drive.straightenWheels();
    return;
  }

  rover.drive.turnRadius = 1/turnRate/deg2rad;
  
  //Ackerman steering
  const dxFront = 1.18; //m
  const dxRear  = 1.08; //m
  const dySteer = 1.06; //m
  rover.setJoint("mob", "steer_lf", Math.atan2(-1*dxFront, dySteer + rover.drive.turnRadius) *rad2deg + (rover.drive.turnRadius<=-dySteer ? -180 : 0));
  rover.setJoint("mob", "steer_rf", Math.atan2(   dxFront, dySteer - rover.drive.turnRadius) *rad2deg + (rover.drive.turnRadius>=dySteer ? -180 : 0));
  rover.setJoint("mob", "steer_lr", Math.atan2(   dxFront, dySteer + rover.drive.turnRadius) *rad2deg + (rover.drive.turnRadius<=-dySteer ? -180 : 0));
  rover.setJoint("mob", "steer_rr", Math.atan2(-1*dxFront, dySteer - rover.drive.turnRadius) *rad2deg + (rover.drive.turnRadius>=dySteer ? -180 : 0));
  
  //Figure out which wheel has the longest path length.
  //That wheel gets to turn full speed.
  //All others turn proportional to path length relative to the longest path length
  var maxWheelPathRadius = 0;
  for(var wheel in rover.wheels){
    rover.wheels[wheel].pathRadius = Math.sqrt(rover.wheels[wheel].x*rover.wheels[wheel].x + (rover.drive.turnRadius-rover.wheels[wheel].y)*(rover.drive.turnRadius-rover.wheels[wheel].y));
    if(rover.wheels[wheel].pathRadius>maxWheelPathRadius) maxWheelPathRadius = rover.wheels[wheel].pathRadius;
  }
  for(var wheel in rover.wheels){
    rover.drive.wheelSpeedRatio[wheel] = rover.wheels[wheel].pathRadius/maxWheelPathRadius;
    //invert wheel drive direction if center of turn is between rover centerline and this wheel:
    if( Math.sign(rover.drive.turnRadius)==Math.sign(rover.wheels[wheel].y)  &&  Math.abs(rover.drive.turnRadius)<Math.abs(rover.wheels[wheel].y) ) rover.drive.wheelSpeedRatio[wheel]*=-1;
  }
  rover.drive.rnavSpeedRatio  = Math.abs(rover.drive.turnRadius)/maxWheelPathRadius;
  rover.drive.setSpeed();
}


rover.drive.setSpeed = function(speed){
  rover.drive.speedRatio = (speed==undefined)? rover.drive.speedRatio : speed;
  rover.drive.speedRatio = Math.min(rover.drive.maxSpeedRatio, Math.max(-1*rover.drive.maxSpeedRatio, Math.round(rover.drive.speedRatio/rover.drive.speedRatioIncr)*rover.drive.speedRatioIncr ));
  rover.drive.prevDriving = rover.drive.driving;
  rover.drive.driving = (rover.drive.speedRatio!=0);
  if(rover.drive.driving && !rover.drive.prevDriving) {
    console.log("Starting drive");
    rover.drive.prevStepTime = new Date().getTime();
    if(rover.audio.started && !rover.audio.drive.isPlaying) rover.audio.drive.state="starting";
  } else if(!rover.drive.driving && rover.drive.prevDriving){
    console.log("Stopping drive");
    if(rover.audio.started && rover.audio.drive.isPlaying) rover.audio.drive.state="stopping";
  }

  const wheelRadius = 0.25; //m
  for(var wheel in rover.drive.wheelSpeed){
    rover.drive.wheelSpeed[wheel] = rover.drive.speedRatio * rover.drive.wheelSpeedRatio[wheel] * rover.drive.maxSpeed / wheelRadius * rad2deg;  //deg/sec
  }
  rover.drive.rnavSpeed     = rover.drive.rnavSpeedRatio * rover.drive.speedRatio * rover.drive.maxSpeed;
  rover.drive.headingRate   = rover.drive.turnRate * rover.drive.rnavSpeed;  // (deg/s) = (deg/m)*(m/s)
  //console.log(rover.drive);
}

      
rover.drive.update = function(secondsElepased) {
  if(!rover.audio.loaded.drive)  //rover.audio.load();
  if(rover.audio.started && rover.audio.drive.state=="stopped") {
    rover.audio.drive.state="starting";
    rover.audio.update();
  }

  // Turn wheels:
  for(var wheel in rover.wheels){
    var jointAngle = rover.joints.wheels[wheel].angle;
    jointAngle += ((rover.drive.wheelSpeed[wheel]*secondsElepased) % 360);
    rover.setJoint("wheels", wheel, jointAngle);
  }

  // Update rover position:
  if(rover.drive.turnRate==0){
    rover.drive.nextPosRnav.copy(rover.axes.forward.clone().multiplyScalar(rover.drive.rnavSpeed*secondsElepased));
  } else {
    rover.drive.headingChange = rover.drive.headingRate*secondsElepased;  //deg        
    rover.drive.nextPosRnav
      .copy(rover.axes.forward.clone().multiplyScalar(rover.drive.turnRadius*Math.sin(rover.drive.headingChange*deg2rad)))
      .add(rover.axes.right.clone().multiplyScalar(rover.drive.turnRadius*(1-Math.cos(rover.drive.headingChange*deg2rad))));
    rover.attitude.yaw = (rover.attitude.yaw + rover.drive.headingChange*deg2rad) %TWO_PI;
    rover.attitude.set();
  }
  var rot = new THREE.Matrix4();
  rot.extractRotation( rover.model.matrix );
  const deltaPos = rover.drive.nextPosRnav.clone().applyMatrix4(rot);
  rover.model.position.copy( rover.model.position.clone().add( deltaPos ));
  rover.model.updateMatrixWorld();

  rover.attitude.projectToSurface();
}







export { rover };
