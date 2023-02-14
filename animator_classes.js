'use-strict'
class IDManager {
	static #_id = 0;
	static #_registeredIDs = {};
	
	static getId(ref) {
		let id = IDManager.#_id++;
		IDManager.#_registeredIDs[id] = ref;
		return id;
	}
	static freeId(id) {
		id = parseInt(id) || 0;
		delete IDManager.#_registeredIDs[id];
		if(Object.keys(IDManager.#_registeredIDs).length <= 0) IDManager.resetIDs();
	}
	static resetIDs() {IDManager.#_id = 0; console.log("No more IDs registered - resetting index.");}
	
	static getById(id) {id = parseInt(id) || 0; return IDManager.#_registeredIDs[id];}
	
	static getStatistic() {return "Currently registered: "+Object.keys(IDManager.#_registeredIDs).length+" IDs. Highest index: "+IDManager.#_id;}
}

/**
 * Class representing an animated Part
 */
class Part {
	#_id = null;
	
	constructor(name, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._partName = String(name);
		this._anchorPart = null;
		this._centered = false;
		this._image = null;
		this._offset = null;
		this._zLevel = null;
		this._groups = [];
		this._partStates = [];
		
		this.setup(data);
	}
	
	destroy() {
		// Destroy all stored part state instances
		let i;
		try {
			for(i = 0; i < this._partStates.length; i++) {this._partStates[i].destroy();}
		} catch(e) {console.warn("Could not destroy state type states", e);}
		this._partStates = null;
		
		IDManager.freeId(this.#_id);
	}
	
	setup(data) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		
		if(data.properties) {
			if(data.properties.anchorPart) this._anchorPart = parseInt(data.properties.anchorPart) || 0;
			if(data.properties.centered) this._centered = Boolean(data.properties.centered);
			if(data.properties.image) this._image = String(data.properties.image);
			if(data.properties.offset) this.offset = data.properties.offset;
			if(data.properties.zLevel) this._zLevel = parseInt(data.properties.zLevel) || 0;
			if(data.properties.transformationGroups) {
				for(let i = 0; i < data.properties.transformationGroups.length; i++) {this.addGroup(data.properties.transformationGroups[i]);}
			}
		}
		if(data.partStates) {
			for(let i in data.partStates) {this.addPartState(i, data.partStates[i]);}
		}
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._partName;}
	set name(val) {this._partName = String(val);}
	
	get anchorPart() {return this._anchorPart}
	anchorPartName() {
		if(this._anchorPart == null) return "";
		let target = IDManager.getById(this._anchorPart);
		if(target == null) return "";
		return target.name;
	}
	set anchorPart(val) {this._anchorPart = val == null ? null : (parseInt(val) || 0);}
	
	get centered() {return this._centered;}
	set centered(val) {this._centered = Boolean(val);}
	
	get image() {return this._image;}
	set image(val) {this._image = val == null ? null : String(val);}
	
	get offset() {return this._offset;}
	set offset(val) {
		if(val == null) {this._offset = null; return;}
		if(typeof val != "object" || !Array.isArray(val) || val.length != 2) this._offset = [0,0];
		else this._offset = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];
	}
	
	get zLevel() {return this._zLevel;}
	set zLevel(val) {this._zLevel = val == null ? null : (parseInt(val) || 1);}
	
	get groups() {return this._groups;}
	addGroup(id) {id = parseInt(id) || 0; this._groups.push(id);}
	removeGroup(id) {
		id = parseInt(id) || 0;
		let i = this._groups.indexOf(id);
		if(i > -1) this._groups.splice(i, 1);
	}
	
	get partStates() {return this._partStates;}
	addPartState(id, data = {}) {id = parseInt(id) || 0; let obj = new PartState(id, data); this._partStates.push(obj); return obj.id;}
	removePartState(id) {
		id = parseInt(id) || 0;
		if(!this._partStates[id]) return;
		let p = this._partStates.splice(id, 1);
		try{p[0].destroy();}catch(e){console.warn("Couldn't destroy part state", e);}
	}
	
	output() {
		let resObj = {properties: {}}
		if(this.anchorPart != null) resObj.properties["anchorPart"] = this.anchorPartName();
		resObj.properties["centered"] = this._centered;
		if(this.image != null) resObj.properties["image"] = this._image;
		if(this.offset != null) resObj.properties["offset"] = this._offset;
		if(this.zLevel != null) resObj.properties["zLevel"] = this._zLevel;
		if(this._groups.length > 0) {
			resObj.properties["transformationGroups"] = [];
			for(let i = 0; i < this._groups.length; i++) {
				let target = IDManager.getById(this._groups[i]);
				if(target == null) continue;
				resObj.properties.transformationGroups.push(target.name);
			}
		}
		if(this._partStates.length > 0) {
			resObj["partStates"] = {};
			for(let i = 0; i < this._partStates.length; i++) {
				resObj.partStates[this._partStates[i].referenceName()] = this._partStates[i].output();
			}
		}
		return resObj;
	}
}

/**
 * Class representing the cross-reference between a State Type and a Part, managing Animation States
 */
class PartState {
	#_id = null;
	
	constructor(id, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._stateTypeId = parseInt(id) || 0;
		this._animationStates = [];
		
		//this.setup(data);
	}
	
	destroy() {
		// Destroy all stored animation state instances
		let i;
		try {
			for(i = 0; i < this._animationStates.length; i++) {this._animationStates[i].destroy();}
		} catch(e) {console.warn("Could not destroy state type states", e);}
		this._animationStates = null;
		
		IDManager.freeId(this.#_id);
	}
	
	setup(data) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		
		for(let n in data) {
			let a = data[n];
			this._animationStates.push(new AnimationState(n, a));
		}
	}
	
	get id() {return this.#_id;}
	
	get reference() {return this._stateTypeId;}
	referenceName() {
		let target = IDManager.getById(this._stateTypeId);
		if(target == null) return "";
		return  target.name;
	}
	set reference(val) {this._stateTypeId = parseInt(val) || 0;}
	
	get animationStates() {return this._animationStates;}
	addAnimationState(id, data = {}) {id = parseInt(id) || 0; let obj = new AnimationState(id, data); this._animationStates.push(obj); return obj.id;}
	removeAnimationState(id) {id = parseInt(id) || 0; if(this._animationStates[id]) this._animationStates.splice(id, 1);}
	
	output() {
		let resObj = {};
		for(let i = 0; i < this._animationStates.length; i++) {
			let s = this._animationStates[i];
			resObj[s.referenceName()] = s.output();
		}
		return resObj;
	}
}

/**
 * Class representing the cross-reference between a State and a PartState, managing frame data
 */
class AnimationState {
	#_id = null;
	
	constructor(id, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._stateId = parseInt(id) || 0;
		this._properties = {};
		this._frameProperties = {};
		
		this.setup(data);
	}
	
	destroy() {
		// Nothing to destroy, only arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		
		if(data.properties) {
			for(let i in data.properties) {
				this.setProperty(i, data.properties[i]);
			}
		}
		if(data.frameProperties) {
			for(let i in data.frameProperties) {
				if(typeof data.frameProperties[i] != "object" || !Array.isArray(data.frameProperties[i])) continue;
				for(let j = 0; j < data.frameProperties[i].length; j++) {
					this.addFrameProperty(i, data.frameProperties[i][j]);
				}
			}
		}
	}
	
	get id() {return this.#_id;}
	
	get reference() {return this._stateId;}
	referenceName() {
		let target = IDManager.getById(this._stateId);
		if(target == null) return "";
		return target.name;
	}
	set reference(val) {this._stateId = parseInt(val) || 0;}
	
	get properties() {return this._properties;}
	getProperty(name) {return this._properties[name];}
	setProperty(name, val) {
		name = String(name);
		switch(name) {
			case "image":
				val = String(val);
				break;
			case "offset":
				if(typeof val != "object" || !Array.isArray(val)) val = [0,0];
				else val = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];
				break;
			case "zLevel":
				val = parseInt(val) || 1;
				break;
			default: return false;
		}
		this._properties[name] = val;
		return true;
	}
	removeProperty(name) {name = String(name); return delete this._properties[name];}
	
	get frameProperties() {return this._frameProperties;}
	getFrameProperty(name) {return this._frameProperties[name];}
	addFrameProperty(name, val) {
		name = String(name);
		switch(name) {
			case "offset":
				if(typeof val != "object" || !Array.isArray(val)) val = [0,0];
				else val = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];
				break;
			case "zLevel":
				val = parseInt(val) || 1;
				break;
			default: return false;
		}
		
		if(this._frameProperties[name] == undefined) this._frameProperties[name] = [];
		
		this._frameProperties[name].push(val);
		return true;
	}
	removeFrameProperty(name, id) {
		id = parseInt(id) || 0;
		if(!this._frameProperties[name]) return false;
		this._frameProperties[name].splice(id, 1);
		if(this._frameProperties[name].length > 0) return true;
		else return delete this._frameProperties[name];
	}
	
	output() {
		let resObj = {};
		if(Object.keys(this._properties).length > 0) resObj.properties = {};
		for(let i in this._properties) {
			let p = this._properties[i];
			resObj.properties[i] = p;
		}
		if(Object.keys(this._frameProperties).length > 0) resObj.frameProperties = {};
		for(let i in this._frameProperties) {
			let f = this._frameProperties[i];
			resObj.frameProperties[i] = f;
		}
		return resObj;
	}
}

/**
 * Class representing a State Type for animated parts
 */
class StateType {
	#_id = null;
	
	// List of allowed custom properties
	#_allowedProperties = {immediateSound: false,immediateSoundRangeMultiplier: true,persistentSound: false,persistentSoundRangeMultiplier: true};
	
	constructor(name, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._stateTypeName = String(name);
		this._default = "none";
		this._states = [];
		this._properties = {};
		
		this.addState("none");
		
		this.setup(data);
	}
	
	destroy() {
		// Destroy all stored state instances
		let i;
		try {
			for(i = 0; i < this._states.length; i++) {this._states[i].destroy();}
		} catch(e) {console.warn("Could not destroy state type states", e);}
		this._states = null;
		
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		
		if(data.default) this.default = data.default;
		if(data.states) {
			for(let s in data.states) {
				let v = data.states[s];
				if(s == "none") continue;
				this.addState(s,v);
			}
		}
		if(typeof data.properties == "object" && !Array.isArray(data.properties)) {
			for(let p in data.properties) {
				let v = data.properties[p];
				this.setProperty(p,v);
			}
		}
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._stateTypeName;}
	set name(val) {this._stateTypeName = String(val);}
	
	get default() {return this._default;}
	set default(val) {this._default = val == null ? "none" : String(val);}
	
	get states() {return this._states;}
	addState(name, data = {}) {name = String(name); let obj = new State(name, data); this._states.push(obj); return obj.id;}
	removeState(id) {id = parseInt(id) || 0; if(this._states[id]) this._states.splice(id, 1);}
	
	get properties() {return this._properties;}
	getProperty(name) {return this._properties[name];}
	setProperty(name, val) {
		let allowed = Object.keys(this.#_allowedProperties);
		let i = allowed.indexOf(name);
		if(i < 0) return false;
		
		val = this.#_allowedProperties[allowed[i]] ? (parseFloat(val) || 1) : String(val);
		
		this._properties[name] = val;
		return true;
	}
	removeProperty(name) {return delete this._properties[name];}
	
	output() {
		let resObj = {states: {}, "default": this._default};
		for(let i = 0; i < this._states.length; i++) {
			let s = this._states[i];
			resObj.states[s.name] = s.output();
		}
		if(Object.keys(this._properties).length > 0) resObj["properties"] = this._properties;
		return resObj;
	}
}

/**
 * Class representing a single state defined in a State Type
 */
class State {
	#_id = null;
	
	// Available modes for animations and their static IDs
	#_modes = ["loop", "transition", "end"];
	static get LOOP() {return 0;}
	static get TRANSITION() {return 1;}
	static get END() {return 2;}
	
	// List of allowed custom properties
	#_allowedProperties = {immediateSound: false,immediateSoundRangeMultiplier: true,persistentSound: false,persistentSoundRangeMultiplier: true};
	
	constructor(name, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._stateName = String(name);
		this._frames = 1;
		this._cycle = 1;
		this._mode = 0;
		this._transition = "none";
		this._properties = {};
		this._frameProperties = {};
		
		this.setup(data);
	}
	
	destroy() {
		// Nothing to destroy, just arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		
		if(data.frames) this._frames = parseInt(data.frames) || 1;
		if(data.cycle) this._cycle = parseFloat(data.cycle) || 1;
		if(data.mode) {
			let i = this.#_modes.indexOf(String(data.mode));
			if(i > -1) this._mode = i;
		}
		if(data.transition) this._transition = String(data.transition);
		if(typeof data.properties == "object" && !Array.isArray(data.properties)) {
			for(let p in data.properties) {
				let v = data.properties[p];
				this.setProperty(p,v);
			}
		}
		if(typeof data.frameProperties == "object" && !Array.isArray(data.frameProperties)) {
			for(let p in data.frameProperties) {
				let v = data.frameProperties[p];
				if(typeof v != "object" || !Array.isArray(v)) continue;
				for(let i = 0; i < v.length; i++) {this.addFrameProperty(p,v[i]);}
			}
		}
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._stateName;}
	set name(val) {this._stateName = String(name);}
	
	get frames() {return this._frames;}
	set frames(val) {this._frames = parseInt(val) || 1;}
	
	get cycle() {return this._cycle;}
	set cycle(val) {this._cycle = parseFloat(val) || 1;}
	
	get mode() {return this._mode;}
	modeText() {return this.#_modes[this._mode];}
	set mode(val) {val = parseInt(val) || 0; if(this.#_modes[val]) this._mode = val;}
	
	get transition() {return this._transition;}
	set transition(val) {this._transition = String(val);}
	
	get properties() {return this._properties;}
	getProperty(name) {return this._properties[name];}
	setProperty(name, val) {
		let allowed = Object.keys(this.#_allowedProperties);
		let i = allowed.indexOf(name);
		if(i < 0) return false;
		
		val = this.#_allowedProperties[allowed[i]] ? (parseFloat(val) || 1) : String(val);
		
		this._properties[name] = val;
		return true;
	}
	removeProperty(name) {return delete this._properties[name];}
	
	get frameProperties() {return this._frameProperties;}
	getFrameProperty(name) {return this._frameProperties[name];}
	addFrameProperty(name, val) {
		let allowed = Object.keys(this.#_allowedProperties);
		let i = allowed.indexOf(name);
		if(i < 0) return false;
		if(this._frameProperties[name] == undefined) this._frameProperties[name] = [];
		
		val = this.#_allowedProperties[allowed[i]] ? (parseFloat(val) || 1) : String(val);
		
		this._frameProperties[name].push(val);
		return true;
	}
	removeFrameProperty(name, id) {
		id = parseInt(id) || 0;
		if(!this._frameProperties[name]) return false;
		this._frameProperties[name].splice(id, 1);
		if(this._frameProperties[name].length > 0) return true;
		else return delete this._frameProperties[name];
	}
	
	output() {
		let resObj = {
			frames: this._frames,
			cycle: this._cycle
		};
		resObj.mode = this.#_modes[this._mode];
		if(this._mode == State.TRANSITION) resObj.transition = this._transition;
		if(Object.keys(this._properties).length > 0) resObj.properties = this._properties;
		if(Object.keys(this._frameProperties).length > 0) resObj.frameProperties = this._frameProperties;
		return resObj;
	}
}

/**
 * Class representing a Particle Emitter
 */
class Emitter {
	#_id = null;
	
	constructor(name, data = {}) {
		this.#_id = IDManager.getId(this);
		
		this._emitterName = String(name);
		this._isAnimated = false;
		this._anchorPart = null;
		this._burstCount = 0;
		this._emissionRate = 0;
		this._particles = [];
		
		this.setup(data);
	}
	
	destroy() {
		// Destroy all stored particle instances
		let i;
		try {
			for(i = 0; i < this._particles.length; i++) {this._particles[i].destroy();}
		} catch(e) {console.warn("Could not destroy emitter particles", e);}
		this._particles = null;
		
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Array.isArray(data) || Object.keys(data).length <= 0) return;
		if(data.anchorPart) this.anchorPart = data.anchorPart;
		if(data.burstCount) this._burstCount = parseInt(data.burstCount) || 0;
		if(data.emissionRate) this._emissionRate = parseFloat(data.emissionRate) || 0;
		if(data.particles && typeof data.particles == "object" && Array.isArray(data.particles)) {
			for(let i = 0; i < data.particles.length; i++) {
				let particle = data.particles[i];
				if(typeof particle != "object" || Array.isArray(particle) || !particle.particle) continue;
				let pData = particle.particle;
				if(i == 0 && typeof pData != "string") this._isAnimated = true;
				this.addParticle(pData);
			}
		}
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._emitterName;}
	set name(val) {this._emitterName = String(name);}
	
	get animated() {return this._isAnimated;}
	set animated(val) {
		val = Boolean(val);
		if(val == this._isAnimated) return;
		for(let i = 0; i < this._particles.length; i++) {
			try{this._particles[i].destroy();}catch(e){console.warn("Could not destroy emitter particles", e);}
		}
		this._particles = [];
		this._isAnimated = val;
	}
	
	get anchorPart() {return this._anchorPart;}
	anchorPartName() {
		if(this._anchorPart == null) return "";
		let target = IDManager.getById(this._anchorPart);
		if(target == null) return "";
		return target.name;
	}
	set anchorPart(val) {this._anchorPart = val == null ? val : String(val);}
	
	get burstcount() {return this._burstCount;}
	set burstcount(val) {this._burstCount = parseInt(val) || 0;}
	
	get emissionRate() {return this._emissionRate;}
	set emissionRate(val) {this._emissionRate = parseFloat(val) || 0;}
	
	get particles() {return this._particles;}
	addParticle(data) {
		let obj;
		if(this._isAnimated) obj = new ParticleAnimated(data);
		else obj = new Particle(data);
		this._particles.push(obj);
		return obj.id;
	}
	
	removeParticle(id) {
		if(!this._particles[id]) return false;
		let x = this._particles.splice(id, 1);
		try{x[0].destroy();}catch(e){console.warn("Could not destroy emitter particle", e);}
		return true;
	}
	
	output() {
		let resObj = {};
		if(this._anchorPart != null) resObj.anchorPart = this.anchorPartName();
		if(this._isAnimated) resObj.emissionRate = this._emissionRate; else resObj.burstCount = this._burstCount;
		resObj.particles = [];
		for(let i = 0; i < this._particles.length; i++) {resObj.particles.push(this._particles[i].output());}
		return resObj;
	}
}

/**
 * Class representing a simple particle (or rather, a reference to a .particle file)
 */
class Particle {
	#_id = null;
	
	constructor(name = "") {
		this.#_id = IDManager.getId(this);
		
		this._particleName = typeof name == "string" ? name : "";
	}
	
	destroy() {
		// Nothing to destroy, just arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._particleName;}
	set name(val) {this._particleName = String(val);}
	
	output() {return {particle: this._particleName};}
}

/**
 * Class representing a complex animated particle
 */
class ParticleAnimated {
	#_id = null;
	
	constructor(parameters = {}) {
		this.#_id = IDManager.getId(this);
		
		this._animation = "";
		this._position = [0,0];
		this._initialVelocity = [0,0];
		this._finalVelocity = [0,0];
		this._destructionTime = 0;
		this._destructionAction = "shrink";
		this._layer = "front";
		this._timeToLive = 0;
		this._flippable = false;
		
		this.setup(parameters);
	}
	
	destroy() {
		// Nothing to destroy, only arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Object.keys(data).length == 0) return;
		
		if(data.animation) this._animation = String(data.animation);
		if(data.position && Array.isArray(data.position)) {
			this._position = [parseFloat(data.position[0]) || 0, parseFloat(data.position[1]) || 0];
		}
		if(data.initialVelocity && Array.isArray(data.initialVelocity)) {
			this._initialVelocity = [parseFloat(data.initialVelocity[0]) || 0, parseFloat(data.initialVelocity[1]) || 0];
		}
		if(data.finalVelocity && Array.isArray(data.finalVelocity)) {
			this._finalVelocity = [parseFloat(data.finalVelocity[0]) || 0, parseFloat(data.finalVelocity[1]) || 0];
		}
		if(data.destructionTime) this._destructionTime = parseFloat(data.destructionTime) || 0;
		if(data.destructionAction) this._destructionAction = String(data.destructionAction);
		if(data.layer) this._layer = String(data.layer);
		if(data.timeToLive) this._timeToLive = parseFloat(data.timeToLive) || 0;
		if(data.flippable) this._flippable = true;
	}
	
	get id() {return this.#_id;}
	
	get position() {return this._position;}
	set position(val) {if(Array.isArray(val)) this._position = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get initialVelocity() {return this._initialVelocity;}
	set initialVelocity(val) {if(Array.isArray(val)) this._initialVelocity = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get finalVelocity() {return this._finalVelocity;}
	set finalVelocity(val) {if(Array.isArray(val)) this._finalVelocity = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get destructionTime() {return this._destructionTime;}
	set destructionTime(val) {this._destructionTime = parseFloat(val) || 0;}
	
	get destructionAction() {return this._destructionAction;}
	set destructionAction(val) {this._destructionAction = String(val);}
	
	get layer() {return this._layer;}
	set layer(val) {this._layer = String(val);}
	
	get timeToLive() {return this._timeToLive;}
	set timeToLive(val) {this._timeToLive = parseFloat(val) || 0;}
	
	get flippable() {return this._flippable;}
	set flippable(val) {this._flippable = Boolean(val);}
	
	output() {
		return {
			particle: {
				type: "animated",
				animation: this._animation,
				position: this._position,
				initialVelocity: this._initialVelocity,
				finalVelocity: this._finalVelocity,
				destructionTime: this._destructionTime,
				destructionAction: this._destructionAction,
				layer: this._layer,
				timeToLive: this._timeToLive,
				flippable: this._flippable
			}
		};
	}
}

/**
 * Class representing a Transformation Group
 */
class Group {
	#_id = null;
	
	constructor(name, parameters = {}) {
		this.#_id = IDManager.getId(this);
		
		this._groupName = String(name);
		this._parameters = parameters;
		
		if(!this._parameters.hasOwnProperty("interpolated")) this._parameters.interpolated = true;
	}
	
	destroy() {
		// Nothing to destroy, just arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._groupName;}
	set name(val) {this._groupName = String(val);}
	
	getParameter(param) {return this._parameters[param];}
	setParameter(param, val) {
		if(param == "interpolated") val = Boolean(val);
		this._parameters[param] = val;
		return true;
	}
	removeParameter(param) {return delete this._parameters[param];}
	
	output() {return this._parameters;}
}

/**
 * Class representing a Sound Pool
 */
class SoundPool {
	#_id = null;
	
	constructor(name, list = []) {
		this.#_id = IDManager.getId(this);
		
		this._poolName = String(name);
		this._list = list;
	}
	
	destroy() {
		// Nothing to destroy, just arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	get id() {return this.#_id;}
	
	get name() {return this._poolName;}
	set name(val) {this._poolName = String(val);}
	
	get list() {return this._list;}
	add(val) {
		this._list.push(String(val));
		return this._list.length-1;
	}
	remove(id) {
		id = parseInt(id);
		if(id <= 0 || id >= this._list.length) return false;
		this._list.splice(id, 1);
		return true;
	}
	
	output() {return this._list;}
}