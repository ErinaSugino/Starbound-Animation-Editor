'use-strict'
class Animator {
	static get COMPRESSION_NONE() {return 0;}
	static get COMPRESSION_MEDIUM() {return 1;}
	static get COMPRESSION_FULL() {return 2;}
	
	#_compressionLevel = 0;
	#_eventListeners = {load: [], update: []};
	#_eventLocks = {load: false, update: false};
	
	constructor() {
		this._tags = {};
		this._parts = [];
		this._stateTypes = [];
		this._particleEmitters = [];
		this._transformationGroups = [];
		this._sounds = [];
	}
	
	destroy() {
		let i;
		this._tags = {};
		try {
			for(i = 0; i < this._parts.length; i++) {this._parts[i].destroy();}
			for(i = 0; i < this._stateTypes.length; i++) {this._stateTypes[i].destroy();}
			for(i = 0; i < this._particleEmitters.length; i++) {this._particleEmitters[i].destroy();}
			for(i = 0; i < this._transformationGroups.length; i++) {this._transformationGroups[i].destroy();}
			for(i = 0; i < this._sounds.length; i++) {this._sounds[i].destroy();}
		} catch(e) {
			console.error("Couldn't clear Animator!", e);
		}
		this._parts = [];
		this._stateTypes = [];
		this._particleEmitters = [];
		this._transformationGroups = [];
		this._sounds = [];
		
		this.#fireEvent("load");
	}
	
	get compressionLevel() {return this.#_compressionLevel;}
	set compressionLevel(val) {
		val = parseInt(val) || 0;
		if(val == Animator.COMPRESSION_NONE || val == Animator.COMPRESSION_MEDIUM || val == Animator.COMPRESSION_FULL) this.#_compressionLevel = val;
	}
	
	addEventListener(e, f, c = -1) {
		e = String(e);
		c = parseInt(c) || -1;
		if(!this.#_eventListeners[e]) return false;
		if(typeof f != "function") return false;
		
		this.#_eventListeners[e].push({callback: f, count: c});
		return true;
	}
	removeEventListener(e, f) {
		e = String(e);
		if(!this.#_eventListeners[e]) return false;
		if(typeof f != "function") return false;
		
		let index = -1;
		for(let i = 0; i < this.#_eventListeners[e].length; i++) {
			if(this.#_eventListeners[e][i].callback == f) {
				index = i;
				break;
			}
		}
		if(index == -1) return false;
		this.#_eventListeners[e].splice(index, 1);
		return true;
	}
	#fireEvent(e) {
		if(!this.#_eventListeners[e] || this.#_eventLocks[e]) return;
		
		for(let i = 0; i < this.#_eventListeners[e].length; i++) {
			let c = this.#_eventListeners[e][i];
			try {c.callback(); if(c.count != -1) c.count--;}
			catch(err) {console.error("Error executing "+e+" event handler", err)}
		}
		
		this.#_eventListeners[e] = this.#_eventListeners[e].filter((v) => {return v.count != 0;});
	}
	
	load(data) {
		this.#_eventLocks.load = true; //Lock loading event - it would trigger on destruction but we will trigger it when we are done anyway
		this.#_eventLocks.update = true; //Lock updating event - we will trigger it a ton but it will only need to be triggered when done
		this.destroy();
		let errorCount = 0;
		
		// Fetch tags
		if(data.globalTagDefaults) {
			for(let i in data.globalTagDefaults) {
				if(this._tags[i]) {console.warn("Warning, your animation file contained duplicate tag names! Overriding "+i); errorCount++;}
				this._tags[i] = data.globalTagDefaults[i];
			}
		}
		
		// Fetch sounds
		let soundPoolNames = {}
		if(data.sounds) {
			for(let i in data.sounds) {
				if(soundPoolNames[i]) {console.warn("Warning, your animation file contains duplicate sound pool names! Already existent: "+i); errorCount++;}
				this.addSoundPool(i, data.sounds[i]);
				soundPoolNames[i] = true;
			}
		}
		
		// Fetch transformation groups - create named index list of ids for reference lookup
		let groupIdList = {};
		if(data.transformationGroups) {
			for(let i in data.transformationGroups) {
				if(groupIdList[i]) {console.warn("Warning, your animation file contains duplicate transformation group names! Already existent: "+i); errorCount++;}
				let id = this.addTransformationGroup(i, data.transformationGroups[i]);
				groupIdList[i] = id;
			}
		}
		
		let stateTypeIdList = {};
		let partIdList = {};
		if(data.animatedParts) {
			// Fetch state types - create named index list of ids and corresponsing state ids for reference lookup
			if(data.animatedParts.stateTypes) {
				for(let i in data.animatedParts.stateTypes) {
					if(stateTypeIdList[i]) {console.warn("Warning, your animation file contains dupliate state type names! Already existent: "+i); errorCount++;}
					let id = this.addStateType(i, data.animatedParts.stateTypes[i]);
					stateTypeIdList[i] = {id: id, states: {}};
					
					let stateType = this._stateTypes[this._stateTypes.length - 1];
					
					let states = stateType.states;
					for(let j = 0; j < states.length; j++) {
						stateTypeIdList[i].states[states[j].name] = states[j].id;
					}
				}
			}
			
			// Shallow-fetch parts - translate transformation group, part state and aniamtion state names to ids and extract anchor parts for later reference
			if(data.animatedParts.parts) {
				let pendingPartData = {}
				for(let i in data.animatedParts.parts) {
					if(partIdList[i]) {console.warn("Warning, your animation file contains duplicate part names! Already existent: "+i); errorCount++;}
					let part = data.animatedParts.parts[i];
					
					let pendingAnchor;
					if(part.properties) {
						if(part.properties.anchorPart) {
							// Remove anchor part - we manually insert it after all part ids exist
							pendingAnchor = part.properties.anchorPart;
							delete part.properties.anchorPart;
						}
						
						if(part.properties.transformationGroups) {
							// We already have all transformation group ids - replace
							for(let j = part.properties.transformationGroups.length - 1; j >= 0; j--) {
								if(groupIdList[part.properties.transformationGroups[j]]) {
									part.properties.transformationGroups[j] = groupIdList[part.properties.transformationGroups[j]];
								} else {
									console.warn("Warning, your animation file contained parts referencing non-existent transformation groups! Removed: "+i+" => "+part.properties.transformationGroups[j]);
									part.properties.transformationGroups.splice(j, 1);
									errorCount++;
								}
							}
							if(part.properties.transformationGroups.length <= 0) delete part.properties.transformationGroups; // Remove if now empty
						}
					}
					
					let pendingPartStates;
					if(part.partStates) {
						// Remove part states - we manually insert them with fetched ids
						pendingPartStates = part.partStates;
						delete part.partStates;
					}
					
					let id = this.addPart(i, part);
					partIdList[i] = id;
					let actPart = this._parts[this._parts.length - 1];
					if(pendingAnchor) pendingPartData[id] = pendingAnchor; // Id now exists, store for later
					
					for(let j in pendingPartStates) {
						if(!stateTypeIdList[j]) {
							// No state type with this name. Ignore
							console.warn("Warning, your animation file contained parts with partStates for non-existent state types! Removed: "+i+" => "+j);
							errorCount++;
							continue;
						}
						
						actPart.addPartState(stateTypeIdList[j].id);
						let actPartState = actPart.partStates[actPart.partStates.length - 1];
						
						for(let k in pendingPartStates[j]) {
							let stateData = pendingPartStates[j][k];
							if(!stateTypeIdList[j].states[k]) {
								// No state with this name in state type. Ignore
								console.warn("Warning, your animation file contained parts with partStates for non-existent states! Removed: "+i+" => "+j+" => "+k);
								errorCount++;
								continue;
							}
							
							actPartState.addAnimationState(stateTypeIdList[j].states[k], stateData);
						}
					}
				}
				
				// Finish fetching parts by adding valid cross-references as anchor part
				for(let i in pendingPartData) {
					let part = IDManager.getById(i);
					if(part == null) continue;
					
					if(!partIdList[pendingPartData[i]]) {
						// Referenced part does not exist. Ignore
						console.warn("Warning, your animation file contained parts referencing non-existant anchor parts! Removed: "+i+" => "+pendingPartData[i]);
						errorCount++;
						continue;
					}
					
					part.anchorPart = partIdList[pendingPartData[i]];
				}
			}
		}
		
		if(data.particleEmitters) {
			// Fetch particle emitters - translate anchor part
			let particleEmitterNames = {};
			for(let i in data.particleEmitters) {
				if(particleEmitterNames[i]) {console.warn("Warning, your animation file contains duplicate particle emitter names! Already existent: "+i); errorCount++;}
				
				if(data.particleEmitters[i].anchorPart) {
					if(partIdList[data.particleEmitters[i].anchorPart]) data.particleEmitters[i].anchorPart = partIdList[data.particleEmitters[i].anchorPart];
					else {
						console.warn("Warning, your animation file contains particle emitters anchored to non-existent parts! Removed: "+i+" => "+data.particleEmitters[i].anchorPart);
						errorCount++;
						delete data.particleEmitters[i].anchorPart;
					}
				}
				
				this.addParticleEmitter(i, data.particleEmitters[i]);
				particleEmitterNames[i] = true;
			}
		}
		
		this.#_eventLocks.load = false;
		this.#_eventLocks.update = false;
		this.#fireEvent("load");
		return errorCount;
	}
	
	addSoundPool(name, list = []) {
		name = String(name);
		for(let i = 0; i < this._sounds.length; i++) {
			if(name == this._sounds[i].name) return null;
		}
		
		let obj = new SoundPool(name, list);
		this._sounds.push(obj);
		
		this.#fireEvent("update");
		return obj.id;
	}
	removeSoundPool(id) {
		id = parseInt(id) || 0;
		if(!this._sounds[id]) return false;
		let x = this._sounds.splice(id, 1)[0];
		try{x.destroy();}catch(e){console.warn("Couldn't destroy Sound Pool", id, e);}
		
		this.#fireEvent("update");
		return true;
	}
	
	addTransformationGroup(name, parameters = {}) {
		name = String(name);
		for(let i = 0; i < this._transformationGroups.length; i++) {
			if(name == this._transformationGroups[i].name) return null;
		}
		
		let obj = new Group(name, parameters);
		this._transformationGroups.push(obj);
		
		this.#fireEvent("update");
		return obj.id;
	}
	removeTransformationGroup(id) {
		id = parseInt(id) || 0;
		if(!this._transformationGroups[id]) return false;
		let x = this._transformationGroups.splice(id, 1)[0];
		let tid = x.id;
		
		// Remove reference from all corresponding parts
		let i;
		for(i = 0; i < this._parts.length; i++) {
			let groups = this._parts[i].groups;
			let j;
			while((j = groups.indexOf(tid)) > -1) {this._parts.removeGroup(j);}
		}
		
		try{x.destroy();}catch(e){console.warn("Couldn't destroy Transformation Group", id, e);}
		
		this.#fireEvent("update");
		return true;
	}
	
	addParticleEmitter(name, data = {}) {
		name = String(name);
		for(let i = 0; i < this._particleEmitters.length; i++) {
			if(name == this._particleEmitters[i].name) return null;
		}
		
		let obj = new Emitter(name, data);
		this._particleEmitters.push(obj);
		
		this.#fireEvent("update");
		return obj.id;
	}
	removeParticleEmitter(id) {
		id = parseInt(id) || 0;
		if(!this._particleEmitters[id]) return false;
		let x = this._particleEmitters.splice(id, 1)[0];
		try{x.destroy();}catch(e){console.warn("Couldn't destroy Particle Emitter", id, e);}
		
		this.#fireEvent("update");
		return true;
	}
	
	addStateType(name, data = {}) {
		name = String(name);
		for(let i = 0; i < this._stateTypes.length; i++) {
			if(name == this._stateTypes[i].name) return null;
		}
		let obj = new StateType(name, data);
		this._stateTypes.push(obj);
		
		this.#fireEvent("update");
		return obj.id;
	}
	removeStateType(id) {
		id = parseInt(id) || 0;
		if(!this._stateTypes[id]) return false;
		let x = this._stateTypes.splice(id, 1)[0];
		let tid = x.id;
		
		// Remove every corresponsing part state from all parts
		let i;
		for(i = 0; i < this._parts.length; i++) {
			let partStates = this._parts[i].partStates;
			let targets = [];
			let j;
			for(j = 0; j < partStates.length; j++) {
				if(partStates[j].reference == tid) targets.unshift(j); // Sort decending
			}
			for(j = 0; j < targets.length; j++) {
				this._parts[i].removePartState(targets[j]); // Remove last first to keep indexes accurate
			}
		}
		
		try{x.destroy();}catch(e){console.warn("Couldn't destroy State Type", id, e);}
		this.#fireEvent("update");
		return true;
	}
	
	addPart(name, data = {}) {
		name = String(name);
		for(let i = 0; i < this._parts.length; i++) {
			if(name == this._parts[i].name) return false;
		}
		
		let obj = new Part(name, data);
		this._parts.push(obj);
		
		this.#fireEvent("update");
		return obj.id;
	}
	removePart(id) {
		id = parseInt(id) || 0;
		if(!this._parts[id]) return false;
		let x = this._parts.splice(id, 1)[0];
		let tid = x.id;
		
		// Remove "anchor part" reference from every other part and particle emitter
		let i;
		for(i = 0; i < this._parts.length; i++) {
			if(this._parts[i].anchorPart == tid) this._parts[i].anchorPart = null;
		}
		for(i = 0; i < this._particleEmitters.length; i++) {
			if(this._particleEmitters[i].anchorPart == id) this._particleEmitters[i].anchorPart = null;
		}
		
		try{x.destroy();}catch(e){console.warn("Couldn't destroy State Type", id, e);}
		this.#fireEvent("update");
		return true;
	}
	
	setTag(name, value) {
		name = String(name);
		if(value == null) return delete this._tags[name];
		value = String(value);
		this._tags[name] = value;
		
		this.#fireEvent("update");
		return true;
	}
	
	propagateStateRemoval(id) {
		id = parseInt(id) || 0;
		for(let i = 0; i < this._parts.length; i++) {
			let partStates = this._parts[i].partStates;
			for(let j = 0; j < partStates.length; j++) {
				let animationStates = partStates[i].animationStates;
				let targets = [];
				let k;
				for(k = 0; k < animationStates.length; k++) {
					if(animationStates[k].reference == id) target.unshift(k); // Sort decending
				}
				for(k = 0; k < targets.length; k++) {
					partStates[j].removeAnimationState(targets[k]); // Remove last first to keep indexes accurate
				}
			}
		}
	}
	
	hasElements() {
		let elems = Object.keys(this._tags).length + this._parts.length + this._stateTypes.length + this._particleEmitters.length + this._transformationGroups.length + this._sounds.length;
		return elems > 0;
	}
	
	output() {
		if(!this.hasElements()) return null;
		
		let output = {globalTagDefaults:this._tags,animatedParts:{}};
		let i,j,temp;
		//parts
		if(this._parts.length > 0) {
			output.animatedParts.parts = {}
			for(i = 0; i < this._parts.length; i++) {
				j = this._parts[i];
				output.animatedParts.parts[j.name] = j.output();
			}
		}
		//stateTypes
		if(this._stateTypes.length > 0) {
			output.animatedParts.stateTypes = {}
			for(i = 0; i < this._stateTypes.length; i++) {
				j = this._stateTypes[i];
				output.animatedParts.stateTypes[j.name] = j.output();
			}
		}
		//particleEmitters
		if(this._particleEmitters.length > 0) {
			output.particleEmitters = {}
			for(i = 0; i < this._particleEmitters.length; i++) {
				j = this._particleEmitters[i];
				output.particleEmitters[j.name] = j.output();
			}
		}
		//transformationGroups
		if(this._transformationGroups.length > 0) {
			output.transformationGroups = {}
			for(i = 0; i < this._transformationGroups.length; i++) {
				j = this._transformationGroups[i];
				output.transformationGroups[j.name] = j.output();
			}
		}
		//sounds
		if(this._sounds.length > 0) {
			output.sounds = {}
			for(i = 0; i < this._sounds.length; i++) {
				j = this._sounds[i];
				output.sounds[j.name] = j.output();
			}
		}
		
		return output;
	}
	
	print(override = null, colorize = false) {
		let res = this.output();
		if(res == null) return res;
		let compressionLevel = override == null ? this.#_compressionLevel : (parseInt(override) || 0);
		if(compressionLevel == Animator.COMPRESSION_NONE) res = JSON.stringify(res, null, "\t");
		else if(compressionLevel == Animator.COMPRESSION_MEDIUM) res = JSON.stringify(res, (k,v) => {
			let s = "";
			if(v instanceof Array && v.length > 0 && (typeof v[0] == "number" || typeof v[0] == "string" || typeof v[0] == "boolean")) {
				s = "$[";
				for(let i = 0; i < v.length; i++) {
					s += typeof v[i] == "number" ? v[i] : (typeof v[i] ==  "boolean" ? String(v[i]) : '"'+v[i]+'"');
					s += ',';
				}
				s = s.substring(0, s.length-1);
				s += "]$";
				return s;
			}
			if(typeof v == "object") {
				let k = Object.keys(v);
				if(k.length == 1 && (typeof v[k[0]] == "number" || typeof v[k[0]] == "string" || typeof v[k[0]] == "boolean")) {
					let vv = v[k[0]]
					s = '${"'+k+'": ';
					s += typeof vv == "number" ? vv : (typeof vv == "boolean" ? String(vv) : '"'+vv+'"');
					s += "}$";
					return s;
				}
			}
			return v;
		}, "\t").replace(/"\$(\{|\[)([^\]\}]*?)(\]|\})\$"/g, (m,p1,p2,p3) => {
			let s = p2.replace(/\\\\"/g,'\"').replace(/\\"/g,'"');
			return ""+p1+s+p3;
		});
		else res = JSON.stringify(res);
		
		if(colorize) {
			res = res.replace(/(?:&|\\"|<|>)/g, (match) => {
				switch(match) {
					case '&': return '&amp;'; break;
					case '\"': return '&quot;'; break;
					case '<': return '&lt;'; break;
					case '>': return '&gt;'; break;
					default: return match;
				}
			}).replace(/^(\s*)("[\w-]+": ?)?("[^"]*"|[\w.+-]*)?([[{}\]]*,?)?$/mg, (match, pIndent, pKey, pVal, pEnd) => {
				let key = '<span class=json_key>',
					num = '<span class=json_number>',
					exp = '<span class=json_expression>';
				let r = '<label class="line">' + pIndent || '';
				if (pKey) r += key + pKey.replace(/[: ]/g, '') + '</span>: ';
				if (pVal) {
					if(pVal.match(/^(?:true|false|null)$/i)) r += exp + pVal + '</span>';
					else if(pVal.match(/^[0-9+\-\.,e]+$/)) r += num + pVal + '</span>';
					else r += '<span>' + pVal + '</span>';
				}
				return r + (pEnd || '') + '</label>';
			});
		}
		
		return res;
	}
}