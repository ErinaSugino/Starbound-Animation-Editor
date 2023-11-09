'use-strict'
class UI {
	constructor() {
		this._tabs = {};
		
		let allTabs = document.querySelectorAll('.tab[id]');
		for(let i = 0; i < allTabs.length; i++) {
			let elem = allTabs[i];
			let id = elem.id;
			let instance;
			
			if(id == "") continue;
			if(this._tabs[id]) {console.warn("Duplicate ID in UI tabs!", id); continue;}
			switch(id) {
				case 'tags': instance = new TagsTab(elem); break;
				case 'parts': instance = new PartsTab(elem); break;
				case 'states': instance = new StatesTab(elem); break;
				case 'particles': instance = new ParticlesTab(elem); break;
				case 'groups': instance = new GroupsTab(elem); break;
				case 'sounds': instance = new SoundsTab(elem); break;
				case 'preview': instance = new PreviewTab(elem); break;
				default: continue; break;
			}
			
			this._tabs[id] = instance;
		}
		
		this._boundHandleTabChange = this.handleTabChange.bind(this);
		document.getElementById('navigation').addEventListener('click', this._boundHandleTabChange);
	}
	
	destroy() {
		document.getElementById('navigation').removeEventListener('click', this._boundHandleTabChange);
		
		for(let i in this._tabs) {
			try{this._tabs[i].destroy();}
			catch(e) {console.error("Could not destroy tab!", e);}
		}
		this._tabs = null;
	}
	
	handleTabChange(e) {
		let target = e.target || null;
		if(target == null) return false;
		if(!target.classList.contains('tab_header')) return true;
		
		let forId = target.dataset['for'] || null;
		if(forId == null) return true;
		let tab = document.getElementById(forId);
		if(tab == null || tab.classList.contains('active')) return true;
		
		let activeTabHeaders = document.querySelectorAll('.tab_header.active');
		for(let i = 0; i < activeTabHeaders.length; i++) {activeTabHeaders[i].classList.remove('active');}
		target.classList.add('active');
		
		for(let i in this._tabs) {
			if(i == forId) continue;
			this._tabs[i].onUnload();
		}
		
		if(this._tabs[forId]) {
			try {this._tabs[forId].onLoad();}
			catch(e) {console.error("Error in "+forId+"'s onLoad handler", e);}
		}
	}
}

class UITab {
	constructor(elem) {
		if(new.target === UITab) throw TypeError("Trying to instantiate abstract class UITab");
		
		this._tab = elem;
		this._navbar = elem.children[0];
		this._content = elem.children[1];
		this._nests = [];
		this._active = false;
		
		this._boundHandleNavigation = this.handleNavigation.bind(this);
		this._navbar.addEventListener('click', this._boundHandleNavigation);
		this._boundResetNavigationLayers = this.resetNavigationLayers.bind(this);
	}
	
	destroy() {
		this._navbar.removeEventListener('click', this._boundHandleNavigation);
	}
	
	get tab() {return this._tab;}
	set tab(val) {
		this._tab = val;
		this._navbar = this._tab.children[0];
		this._content = this._tab.children[1];
	}
	
	get navbar() {return this._navbar;}
	get content() {return this._content;}
	
	addNavigationLayer(name, data) {
		this._nests.push({name: name, data: data});
		
		this.buildNavbar();
		this.buildLayeredContent(data);
	}
	removeNavigationLayer(depth = 1) {
		depth = parseInt(depth) || 1;
		this._nests.splice(depth * -1);
		
		let data = (this._nests[Math.max(this._nests.length - 1, 0)] || {}).data || null;
		this.buildNavbar();
		this.buildLayeredContent(data);
	}
	resetNavigationLayers() {
		this._nests = [];
	}
	
	buildNavbar() {
		let highest = this._nests.length - 1;
		
		let backButton = document.createElement('div');
		backButton.classList.add('back_button');
		if(highest == -1) backButton.classList.add('invisible');
		backButton.append("↩");
		this._navbar.replaceChildren(backButton);
		
		let navelem = document.createElement('div');
		navelem.classList.add('nav_element');
		navelem.append("Overview");
		navelem.dataset['depth'] = highest + 1;
		this._navbar.append(navelem);
		
		for(let i = 0; i < this._nests.length; i++) {
			let data = this._nests[i];
			let marker = document.createElement('span');
			marker.classList.add('no_select');
			marker.innerText = "—→";
			this._navbar.append(marker);
			navelem = document.createElement('div');
			navelem.classList.add('nav_element');
			navelem.append(String(data.name));
			navelem.dataset['depth'] = (highest - i);
			this._navbar.append(navelem);
		}
		
		navelem.classList.add('current');
	}
	
	handleNavigation(e) {
		let target = e.target;
		if(target == null) return false;
		
		if(target.classList.contains('back_button') && !target.classList.contains('invisible')) this.removeNavigationLayer();
		else if(target.classList.contains('nav_element') && !target.classList.contains('current')) {
			let depth = target.dataset['depth'];
			this.removeNavigationLayer(depth);
		}
		return true;
	}
	
	buildLayeredContent(data) {return;}
	
	onLoad() {if(this._active) return; this._tab.classList.add('active'); this._active = true; animator.addEventListener('load', this._boundResetNavigationLayers);}
	onUnload() {if(!this._active) return; this._tab.classList.remove('active'); this._active = false; animator.removeEventListener('load', this._boundResetNavigationLayers);}
}

class PreviewTab extends UITab {
	#_isClean = true;
	
	constructor(elem) {
		super(elem);
		
		this._animator = animator;
		this._output = this._content.querySelector('pre');
		this._anchor = this._output.parentElement;
		if(this._output.innerHTML != "") this.#_isClean = false;
		
		this._boundUpdatePreview = this.updatePreview.bind(this);
		this._boundResetPreview = this.resetPreview.bind(this);
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this.resetPreview();
		this._animator = null;
		super.destroy();
	}
	
	onLoad() {
		if(this._active) return;
		super.onLoad();
		
		if(!this._animator) return;
		this.updatePreview();
		
		animator.addEventListener('load', this._boundUpdatePreview);
	}
	onUnload() {
		if(!this._active) return;
		super.onUnload();
		
		animator.removeEventListener('load', this._boundUpdatePreview);
		let parentElem = this._output.parentElement;
		this.resetPreview();
	}
	
	updatePreview() {
		let result = this._animator.print(Animator.COMPRESSION_NONE);
		this.resetPreview();
		if(result == null) {this._output.innerText = "Project is empty."; this.#_isClean = false; return;}
		//this._output.innerHTML = result;
		
		let fragment = document.createDocumentFragment();
		
		// Colorization
		var lines = result.split("\n");
		for(let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let matches = line.match(/^(\s*)("[\w-]+": ?)?("[^"]*"|[\w.+-]*)?([[{}\]]*,?)?$/m);
			let result = document.createElement('label');
			result.classList.add('line');
			let sub;
			
			if(matches[1]) result.append(matches[1]);
			if(matches[2]) {
				sub = document.createElement('span');
				sub.classList.add('json_key');
				sub.append(matches[2].replace(/[: ]/g, ''));
				result.append(sub);
				result.append(": ");
			}
			if(matches[3]) {
				sub = document.createElement('span');
				if(matches[3].match(/^(?:true|false|null)$/i)) sub.classList.add('json_expression');
				else if(matches[3].match(/^[0-9+\-\.,e]+$/)) sub.classList.add('json_number');
				sub.append(matches[3]);
				result.append(sub);
			}
			if(matches[4]) result.append(matches[4]);
			fragment.append(result);
		}
		
		this._output.append(fragment);
		
		let highestIndex = String(this._output.children.length).length;
		let indentWidth = ''+(highestIndex*8)+'px';
		this._output.style.setProperty('--indent_width', indentWidth);
		
		this.#_isClean = false;
	}
	
	resetPreview() {
		if(this.#_isClean) return;
		this._output.remove();
		this._output = document.createElement('pre');
		this._anchor.appendChild(this._output);
	}
}

class TagsTab extends UITab {
	constructor(elem) {
		super(elem);
		this._animator = animator;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleDblClick = this.handleDblClick.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		
		this._boundUpdateView = this.updateView.bind(this);
		
		this._tagsElem = this._content.querySelector('.tags');
		
		this._tags = [];
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('dblclick', this._boundHandleDblClick);
		this._animator.removeEventListener('load', this._boundUpdateView);
		this._tagsElem.innerHTML = "";
		this._tags = [];
		this._animator = null;
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._animator.addEventListener('load', this._boundUpdateView);
		this.updateView();
	}
	
	onUnload() {
		this._tagsElem.innerHTML = "";
		this._tags = [];
		this._animator.removeEventListener('load', this._boundUpdateView);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "BUTTON") return false;
		
		let action = target.dataset['action'];
		if(action == "addTag") this.addTag();
		else if (action == "deleteTag") this.removeTag(target);
		return true;
	}
	
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		this.editTag(target);
	}
	
	addTag() {
		Modal.confirm(
			"Add Global Tag",
			"Enter name and value of new global tag.<br><br><input class='textfield large' type='text' id='tagName' placeholder='Tag Name' /><br><input class='textfield large' type='text' id='tagVal' placeholder='Value' />",
			(function() {
				let name = document.getElementById('tagName').value;
				let val = document.getElementById('tagVal').value;
				if(name != "") {
					this.checkAddTag(name, val);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"medium",
			false
		);
	}
	checkAddTag(name, val) {
		if(animator._tags[name]) {
			let id = this._tags.indexOf(name);
			Modal.confirm(
				"Overwrite Global Tag",
				"A tag with this name already exists!<br><br>Do you want to overwrite the value instead?",
				(function() {
					if(id == -1) this.doAddTag(name, val);
					else this.doEditTag(id, val);
					return true;
				}).bind(this),
				null,
				"Overwrite",
				"Abort",
				"small",
				true
			);
		}
		else this.doAddTag(name, val);
	}
	doAddTag(name, val, apply=true) {
		let newTag = document.createElement('div');
		newTag.classList.add('tag');
		newTag.dataset['name'] = name;
		newTag.dataset['value'] = val;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell');
		cell1.innerText = name + ":";
		newTag.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'grow', 'editable');
		cell2.innerText = val;
		newTag.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Tag";
		button.dataset['action'] = "deleteTag";
		cell3.append(button);
		newTag.append(cell3);
		
		this._tagsElem.append(newTag);
		this._tags.push(name);
		
		if(apply) animator.setTag(name, val);
	}
	
	editTag(elem) {
		let orgValue = elem.parentElement.dataset['value'];
		let name = elem.parentElement.dataset['name'];
		let id = this._tags.indexOf(name);
		if(id == -1) return;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "Value";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let val = this.value;
			if(val == orgValue) this.parentElement.innerText = orgValue;
			else self.doEditTag(id, val);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	doEditTag(id, val) {
		if(id < 0) return;
		
		this._tagsElem.children[id].children[1].innerText = val;
		this._animator.setTag(this._tags[id], val);
	}
	
	removeTag(elem) {
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> Tag (with data)
		let id = this._tags.indexOf(name);
		if(id == -1) return;
		
		Modal.confirm(
			"Delete Global Tag",
			"Are you sure you want to delete the global tag \""+name+"\"?",
			(function() {this.doRemoveTag(id); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveTag(id) {
		this._tagsElem.children[id].remove();
		this._animator.setTag(this._tags[id], null);
		this._tags.splice(id, 1);
	}
	
	updateView() {
		this._tagsElem.innerHTML = "";
		for(let i in this._animator._tags) {
			this.doAddTag(i, this._animator._tags[i], false);
		}
	}
}

class PartsTab extends UITab {
	
}

class StatesTab extends UITab {
	constructor(elem) {
		super(elem);
		this._animator = animator;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleDblClick = this.handleDblClick.bind(this);
		this._boundHandleChange = this.handleChange.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		this._content.addEventListener('change', this._boundHandleChange);
		
		this._boundBuildNavbar = this.buildNavbar.bind(this);
		this._boundBuildLayeredContent = this.buildLayeredContent.bind(this);
		
		this._contentList = [];
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('dblclick', this._boundHandleDblClick);
		this._content.removeEventListener('change', this._boundHandleChange);
		this._content.innerHTML = '';
		this._contentList = [];
		this._animator.removeEventListener('load', this._boundBuildNavbar);
		this._animator.removeEventListener('load', this._boundBuildLayeredContent);
		this._animator = null;
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._animator.addEventListener('load', this._boundBuildNavbar);
		this._animator.addEventListener('load', this._boundBuildLayeredContent);
		this.buildNavbar();
		this.buildLayeredContent();
	}
	
	onUnload() {
		this._content.innerHTML = '';
		this._contentList = [];
		this._nests = [];
		this._animator.removeEventListener('load', this._boundBuildNavbar);
		this._animator.removeEventListener('load', this._boundBuildLayeredContent);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		
		if(target.tagName == "BUTTON") {
			let action = target.dataset['action'];
			if(action == "addStateType") this.addStateType(target);
			else if(action == "deleteStateType") this.removeStateType(target);
			else if(action == "editStateType") this.openStateType(target);
			else if(action == "addState") this.addState(target);
			else if(action == "deleteState") this.removeState(target);
			else if(action == "editState") this.openState(target);
			else if(action == "addPropertyType") this.addPropertyType(target);
			else if(action == "addPropertyState") this.addPropertyState(target);
			else if(action == "deletePropertyType") this.removePropertyType(target);
			else if(action == "deletePropertyState") this.removePropertyState(target);
			else if(action == "addFrameProperty") this.addFrameProperty(target);
			else if(action == "deleteFrameProperty") this.removeFrameProperty(target);
			else if(action == "addFramePropertyValue") this.addFramePropertyValue(target);
			else if(action == "deleteFramePropertyValue") this.removeFramePropertyValue(target);
		} else if(target.classList.contains('indicator')) this.toggleOpen(target);
		
		return true;
	}
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		if(target.parentElement.classList.contains('stateType')) this.renameStateType(target);
		else if(target.parentElement.classList.contains('state')) this.renameState(target);
	}
	handleChange(e) {
		
	}
	
	buildLayeredContent(data = null) {
		this._content.innerHTML = '';
		this._contentList = [];
		
		if(data == null) this.loadList();
		else if(data.layer == 1) this.loadStateType(data.id);
		else if(data.layer == 2) this.loadState(data.id, data.refId);
		else this.loadList();
	}
	loadList() {
		this._contentElem = document.createElement('div');
		this._contentElem.classList.add('states');
		this._content.append(this._contentElem);
		
		let warning = document.createElement('div');
		warning.classList.add('warning');
		warning.innerText = 'No state types defined.';
		this._content.append(warning);
		
		let controls = document.createElement('div');
		controls.classList.add('sticky_controls');
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('modern', 'tiny');
		button.title = "Add new\nstate type";
		button.innerText = '+';
		button.dataset['action'] = 'addStateType';
		controls.append(button);
		this.content.append(controls);
		
		for(let i = 0; i < this._animator._stateTypes.length; i++) {
			this.doAddStateType(this._animator._stateTypes[i].name, i);
		}
	}
	loadStateType(id) {
		this._contentElem = null;
		this._content.innerHTML = "";
		let template = document.getElementById('fragment_stateType').content;
		let clone = document.importNode(template, true);
		let stateType = this._animator._stateTypes[id];
		
		clone.children[0].dataset['stateTypeId'] = id;
		
		this._contentElem = clone.getElementById('states');
		
		let select = clone.getElementById('default');
		for(let i = 0; i < stateType.states.length; i++) {
			let state = stateType.states[i];
			let option = document.createElement('option');
			option.value = state.name;
			option.innerText = state.name;
			if(stateType.default == state.name) option.selected = true;
			select.appendChild(option);
			
			if(i > 0) this.doAddState(id, state.name, i);
		}
		
		let selects = clone.children[0].getElementsByTagName('select');
		for(let i = 0; i < selects.length; i++) {selects[i].addEventListener('change', this.updateSelect.bind(this));}
		
		let count = this._contentElem.children.length;
		this._contentElem.parentElement.previousElementSibling.children[2].innerText = count+" States";
		
		this._content.appendChild(clone);
		
		for(let i in stateType.properties) {
			this.doAddPropertyType(i, stateType.properties[i]);
		}
	}
	openStateType(elem) {
		let stateTypeId = parseInt(elem.parentElement.parentElement.dataset['id']) || 0; // Button -> cell -> state type (with data)
		let name = this._animator._stateTypes[stateTypeId].name;
		
		this.addNavigationLayer("StateType: "+name, {layer: 1, id: stateTypeId});
	}
	
	loadState(id, refId) {
		this._contentElem = null;
		this._content.innerHTML = "";
		let template = document.getElementById('fragment_state').content;
		let clone = document.importNode(template, true);
		let stateType = animator._stateTypes[id];
		let state = stateType.states[refId];
		
		clone.children[0].dataset['stateTypeId'] = id;
		clone.children[0].dataset['stateId'] = refId;
		
		clone.getElementById('frames').value = state.frames;
		clone.getElementById('cycle').value = state.cycle;
		let select = clone.getElementById('mode');
		for(let i = 0; i < State.modes().length; i++) {
			let option = document.createElement('option');
			option.value = i;
			option.innerText = State.modes()[i] || "Unknown";
			if(state.mode == i) option.selected = true;
			select.appendChild(option);
		}
		
		let inputs = clone.children[0].getElementsByTagName('input');
		for(let i = 0; i < inputs.length; i++) {inputs[i].addEventListener('blur', this.updateInput.bind(this));}
		let selects = clone.children[0].getElementsByTagName('select');
		for(let i = 0; i < selects.length; i++) {selects[i].addEventListener('change', this.updateSelect.bind(this));}
		
		this._content.appendChild(clone);
		
		for(let i in state.properties) {
			this.doAddPropertyState(i, state.properties[i]);
		}
		for(let i in state.frameProperties) {
			this.doAddFrameProperty(i, state.frameProperties[i]);
		}
		
		this.updateMode();
	}
	openState(elem) {
		let stateId = parseInt(elem.parentElement.parentElement.dataset['id']) || 0; // Button -> cell -> state (with data)
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId']) || 0; // Button -> cell -> state -> state list -> cell -> state type (with data)
		let name = this._animator._stateTypes[stateTypeId].states[stateId].name;
		
		this.addNavigationLayer("State: "+name, {layer: 2, id: stateTypeId, refId: stateId});
	}
	
	addStateType() {
		Modal.confirm(
			"Add State Type",
			"Enter name of the new state type.<br><br><input class='textfield large' type='text' id='stateTypeName' placeholder='State Type Name' />",
			(function() {
				let name = document.getElementById('stateTypeName').value;
				if(name != "") {
					this.checkAddStateType(name);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddStateType(name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._stateTypes.length; i++) {
			if(this._animator._stateTypes[i].name == name) {isTaken = true; break;}
		}
		
		if(isTaken) ToastModal.open("StateType name taken", true);
		else this.doAddStateType(name);
	}
	doAddStateType(name, refId=-1) {
		if(refId == -1) {this._animator.addStateType(name); refId = this._animator._stateTypes.length - 1;}
		let stateType = this._animator._stateTypes[refId];
		
		let newStateType = document.createElement('div');
		newStateType.classList.add('stateType');
		newStateType.dataset['name'] = name;
		newStateType.dataset['id'] = refId;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'editable');
		cell1.innerText = name;
		newStateType.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'grow', 'right');
		cell2.innerHTML = "<span>States: "+(stateType.states.length-1)+"</span><br><span>Default: "+stateType.default+"</span>";
		newStateType.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '✎';
		button.title = "Edit State Type";
		button.dataset['action'] = "editStateType";
		cell3.append(button);
		button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove State Type";
		button.dataset['action'] = "deleteStateType";
		cell3.append(button);
		newStateType.append(cell3);
		
		this._contentElem.append(newStateType);
		this._contentList.push(name);
	}
	
	renameStateType(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let id = this._contentList.indexOf(orgValue);
		if(id == -1) return;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "State Type Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.checkRenameStateType(id, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenameStateType(id, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._stateTypes.length; i++) {
			if(this._animator._stateTypes[i].name == name) {isTaken = true; break;}
		}
		if(isTaken) {
			if(this._contentElem) {
				let orgName = this._contentElem.children[id].dataset['name'];
				this._poolsElem.children[id].children[1].innerText = orgName;
			}
			ToastModal.open("StateType name taken", true);
		} else this.doRenameStateType(id, name);
	}
	doRenameStateType(id, name) {
		if(id < 0) return;
		
		if(this._contentElem) {
			this._contentElem.children[id].children[1].innerText = name;
			this._contentElem.children[id].dataset['name'] = name;
		}
		this._animator._stateTypes[id].name = name;
	}
	
	removeStateType(elem) {
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> State Type (with data)
		let id = this._contentList.indexOf(name);
		if(id == -1) return;
		
		Modal.confirm(
			"Delete State Type",
			"Are you sure you want to delete the state type \""+name+"\"?<br><br><b>Every state and every part state associated with it will be removed too!</b>",
			(function() {this.doRemoveStateType(id); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveStateType(id) {
		this._contentElem.children[id].remove();
		this._animator.removeStateType(id);
		this._contentList.splice(id, 1);
		
		for(let i = 0; i < this._contentElem.children.length; i++) {
			this._contentElem.children[i].dataset['id'] = i;
		}
	}
	
	toggleOpen(elem) {
		let parent = elem.parentElement;
		let isOpen = parent.classList.contains('open');
		
		parent.classList.toggle('open');
	}
	
	addState(elem) {
		let id = parseInt(elem.parentElement.parentElement.parentElement.parentElement.dataset['stateTypeId']) || 0; // Button -> container -> row -> list -> state type (with data)
		let name = this._animator._stateTypes[id].name;
		Modal.confirm(
			"Add State to Type",
			"Enter state name to add to the state type \""+name+"\".<br><br><input class='textfield large' type='text' id='stateName' placeholder='State Name' />",
			(function() {
				let val = document.getElementById('stateName').value;
				if(name != "") {
					this.checkAddState(id, val);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"medium",
			false
		);
	}
	checkAddState(typeId, value) {
		let isTaken = false;
		for(let i = 0; i < this._animator._stateTypes[typeId].states.length; i++) {
			if(this._animator._stateTypes[typeId].states[i].name == value) {isTaken = true; break;}
		}
		
		if(isTaken) ToastModal.open("State name taken", true);
		else this.doAddState(typeId, value);
	}
	doAddState(typeId, value, refId=-1) {
		if(refId==-1) this._animator._stateTypes[typeId].addState(value);
		let actRefId = refId==-1?this._animator._stateTypes[typeId].states.length-1:refId;
		let state = this._animator._stateTypes[typeId].states[actRefId];
		let newState = document.createElement('div');
		newState.classList.add('state');
		newState.dataset['id'] = (actRefId);
		newState.dataset['name'] = value;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow', 'editable');
		cell1.innerText = value;
		newState.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell');
		let text = "Frames: "+state.frames+" @ "+state.cycle+"\n";
		text += state.modeText();
		if(state.mode == State.TRANSITION) text+= ' -> '+state.transition;
		cell2.innerText = text;
		newState.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove State\nfrom State Type";
		button.dataset['action'] = "deleteState";
		cell3.append(button);
		button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '✎';
		button.title = "Edit State";
		button.dataset['action'] = "editState";
		cell3.append(button);
		newState.append(cell3);
		
		this._contentElem.append(newState);
		let count = this._contentElem.children.length;
		if(refId==-1) {this.updateDefaultList(typeId); document.getElementById('statecount').innerText = count+" States";}
	}
	updateDefaultList(stateTypeId) {
		let stateType = this._animator._stateTypes[stateTypeId];
		let select = document.getElementById('default');
		select.innerHTML = "";
		for(let i = 0; i < stateType.states.length; i++) {
			let state = stateType.states[i];
			let option = document.createElement('option');
			option.value = state.name;
			option.innerText = state.name;
			if(stateType.default == state.name) option.selected = true;
			select.appendChild(option);
		}
	}
	
	renameState(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let refId = parseInt(elem.parentElement.parentElement.parentElement.parentElement.parentElement.dataset['stateTypeId'])||0;
		let id = parseInt(elem.parentElement.dataset['id'])||0;;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "State Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.checkRenameState(id, refId, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenameState(id, refId, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._stateTypes[refId].states.length; i++) {
			if(this._animator._stateTypes[refId].states[i].name == name) {isTaken = true; break;}
		}
		if(isTaken) {
			if(this._contentElem) {
				let state = this._contentElem.children[id-1];
				let orgName = state.dataset['name'];
				state.children[0].innerText = orgName;
			}
			ToastModal.open("State name taken", true);
		} else this.doRenameState(id, refId, name);
	}
	doRenameState(id, refId, name) {
		if(id < 0 || refId < 0) return;
		
		if(this._contentElem) {
			this._contentElem.children[id-1].children[0].innerText = name;
			this._contentElem.children[id-1].dataset['name'] = name;
		}
		this._animator._stateTypes[refId].states[id].name = name;
	}
	
	removeState(elem) {
		let stateTypeId = parseInt(elem.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.dataset['stateTypeId']) ||  0; // Button -> cell -> state -> container -> container -> row -> stateType (with data)
		let stateType = this._animator._stateTypes[stateTypeId];
		let stateId = parseInt(elem.parentElement.parentElement.dataset['id']) || 1;
		let name = stateType.states[stateId].name;
		
		Modal.confirm(
			"Delete State from Type",
			"Are you sure you want to delete state type \""+stateType.name+"\" state \""+name+"\"?<br><br><b>This will remove every part state data associated with it!</b>",
			(function() {this.doRemoveState(stateTypeId, stateId); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveState(typeId, index) {
		this._animator._stateTypes[typeId].removeState(index);
		this._contentElem.children[index-1].remove();
		
		for(let i = 0; i < this._contentElem.children.length; i++) {this._contentElem.children[i].dataset['id'] = i+1;}
		
		this.updateDefaultList(typeId);
		
		let count = this._contentElem.children.length;
		document.getElementById('statecount').innerText = count+" States";
	}
	
	addPropertyType() {
		let id = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateType = this._animator._stateTypes[id];
		let properties = stateType.properties;
		let allowed = StateType.allowedProperties();
		
		let options = "";
		for(let i in allowed) {
			if(!Object.hasOwn(properties, i) && document.getElementById('prop_'+i) == null) options += "<option value=\""+i+"\">"+i+"</option>";
		}
		
		Modal.confirm(
			"Add Property",
			"Select property to add.<br><br><select class='modern large' id='propertyList'>"+options+"</select>",
			(function() {
				let value = document.getElementById('propertyList').value;
				if(value != "" && value != null) {
					this.checkAddPropertyType(value);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddPropertyType(name = null) {
		if(name == null) return;
		
		let id = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateType = this._animator._stateTypes[id];
		
		if(!Object.hasOwn(StateType.allowedProperties(), name)) {ToastModal.open("Invalid property", true); return;}
		
		if(document.getElementById('prop_'+name) != null) ToastModal.open("Property already set", true);
		else this.doAddPropertyType(name);
	}
	doAddPropertyType(name, val = null) {
		let id = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateType = this._animator._stateTypes[id];
		let varTypes = StateType.allowedProperties();
		let isNumber = !!varTypes[name];
		
		let newProperty = document.createElement('div');
		newProperty.classList.add('property');
		newProperty.id = "prop_"+name;
		newProperty.dataset['param'] = name;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow');
		let label = document.createElement('label');
		label.classList.add('description');
		label.innerText = name+":";
		cell1.append(label);
		let input = document.createElement('input');
		input.classList.add('textfield');
		if(isNumber) {
			input.type = "number";
			input.step = "0.01";
			input.min = "0";
			input.value = val || 0;
		} else {
			input.type = "text";
			input.value = val || "";
		}
		input.placeholder = "Value";
		input.title = name+" - Value";
		input.id = "prop_"+name+"_val";
		input.addEventListener('blur', this.handleTypeProperty.bind(this));
		cell1.append(input);
		newProperty.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Property";
		button.dataset['action'] = "deletePropertyType";
		cell2.append(button);
		newProperty.append(cell2);
		
		document.getElementById('properties').append(newProperty);
	}
	
	removePropertyType(elem) {
		let name = elem.parentElement.parentElement.dataset['param'];
		
		Modal.confirm(
			"Delete Property",
			"Are you sure you want to delete property "+name+"?",
			(function() {this.doRemovePropertyType(name); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemovePropertyType(name) {
		let id = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateType = this._animator._stateTypes[id];
		
		stateType.removeProperty(name);
		
		document.getElementById('prop_'+name).remove();
	}
	handleTypeProperty(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT") return false;
		
		let sid = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateType = animator._stateTypes[sid];
		
		let id = target.id, value = target.value;
		id = id.replace(/prop_(.+?)_val/, "$1");
		
		stateType.setProperty(id, value);
	}
	addPropertyState() {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		let properties = state.properties;
		let allowed = State.allowedProperties();
		
		let options = "";
		for(let i in allowed) {
			if(!Object.hasOwn(properties, i) && document.getElementById('prop_'+i) == null) options += "<option value=\""+i+"\">"+i+"</option>";
		}
		
		Modal.confirm(
			"Add Property",
			"Select property to add.<br><br><select class='modern large' id='propertyList'>"+options+"</select>",
			(function() {
				let value = document.getElementById('propertyList').value;
				if(value != "" && value != null) {
					this.checkAddPropertyState(value);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddPropertyState(name = null) {
		if(name == null) return;
		
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		if(!Object.hasOwn(State.allowedProperties(), name)) {ToastModal.open("Invalid property", true); return;}
		
		if(document.getElementById('prop_'+name) != null) ToastModal.open("Property already set", true);
		else this.doAddPropertyState(name);
	}
	doAddPropertyState(name, val = null) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		let varTypes = State.allowedProperties();
		let isNumber = !!varTypes[name];
		
		let newProperty = document.createElement('div');
		newProperty.classList.add('property');
		newProperty.id = "prop_"+name;
		newProperty.dataset['param'] = name;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow');
		let label = document.createElement('label');
		label.classList.add('description');
		label.innerText = name+":";
		cell1.append(label);
		let input = document.createElement('input');
		input.classList.add('textfield');
		if(isNumber) {
			input.type = "number";
			input.step = "0.01";
			input.min = "0";
			input.value = val || 0;
		} else {
			input.type = "text";
			input.value = val || "";
		}
		input.placeholder = "Value";
		input.title = name+" - Value";
		input.id = "prop_"+name+"_val";
		input.addEventListener('blur', this.handleStateProperty.bind(this));
		cell1.append(input);
		newProperty.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Property";
		button.dataset['action'] = "deletePropertyType";
		cell2.append(button);
		newProperty.append(cell2);
		
		document.getElementById('properties').append(newProperty);
	}
	
	removePropertyState(elem) {
		let name = elem.parentElement.parentElement.dataset['param'];
		
		Modal.confirm(
			"Delete Property",
			"Are you sure you want to delete property "+name+"?",
			(function() {this.doRemovePropertyState(name); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemovePropertyState(name) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		state.removeProperty(name);
		
		document.getElementById('prop_'+name).remove();
	}
	handleStateProperty(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT") return false;
		
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		let id = target.id, value = target.value;
		id = id.replace(/prop_(.+?)_val/, "$1");
		
		state.setProperty(id, value);
	}
	addFrameProperty() {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		let properties = state.frameProperties;
		let allowed = State.allowedFrameProperties();
		
		let options = "";
		for(let i in allowed) {
			if(!Object.hasOwn(properties, i) && document.getElementById('fprop_'+i) == null) options += "<option value=\""+i+"\">"+i+"</option>";
		}
		
		Modal.confirm(
			"Add Frame Property",
			"Select frame property to add.<br><br><select class='modern large' id='fpropertyList'>"+options+"</select>",
			(function() {
				let value = document.getElementById('fpropertyList').value;
				if(value != "" && value != null) {
					this.checkAddFrameProperty(value);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddFrameProperty(name = null) {
		if(name == null) return;
		
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		if(!Object.hasOwn(State.allowedFrameProperties(), name)) {ToastModal.open("Invalid<br>frame property", true); return;}
		
		if(document.getElementById('prop_'+name) != null) ToastModal.open("Frame Property<br>already set", true);
		else this.doAddFrameProperty(name);
	}
	doAddFrameProperty(name, values = []) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		let varTypes = State.allowedProperties();
		let isNumber = !!varTypes[name];
		
		let newFrameProperty = document.createElement('div');
		newFrameProperty.classList.add('frameProperty');
		newFrameProperty.id = "fprop_"+name;
		newFrameProperty.dataset['param'] = name;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell');
		let label = document.createElement('label');
		label.classList.add('description');
		label.innerText = name+":";
		cell1.append(label);
		newFrameProperty.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'grow');
		let list = document.createElement('div');
		list.classList.add('list');
		let container = document.createElement('div');
		list.append(container);
		let warning = document.createElement('div');
		warning.classList.add('warning');
		warning.innerText = "No values defined.";
		list.append(warning);
		let controls = document.createElement('div');
		controls.classList.add('non_sticky_controls');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.dataset['action'] = "addFramePropertyValue";
		button.title = "Add new value\nfor this frame property";
		button.innerText = "+";
		controls.append(button);
		list.append(controls);
		cell2.append(list);
		newFrameProperty.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Frame Property";
		button.dataset['action'] = "deleteFrameProperty";
		cell3.append(button);
		newFrameProperty.append(cell3);
		
		document.getElementById('frameProperties').append(newFrameProperty);
		
		for(let i = 0; i < values.length; i++) {
			this.doAddFramePropertyValue(name, values[i], false);
		}
	}
	
	removeFrameProperty(elem) {
		let name = elem.parentElement.parentElement.dataset['param'];
		
		Modal.confirm(
			"Delete Frame Property",
			"Are you sure you want to delete frame property "+name+"?",
			(function() {this.doRemovePropertyState(name); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveFrameProperty(name) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		state.deleteFrameProperty(name);
		
		document.getElementById('fprop_'+name).remove();
	}
	addFramePropertyValue(elem) {
		let name = elem.parentElement.parentElement.parentElement.parentElement.dataset['param']; //Button -> controls -> list -> cell -> frameProperty (with data)
		let isNumber = !!(State.allowedFrameProperties()[name] || false);
		let input = isNumber ? "<input id='frameValue' type='number' class='textfield' min='0', step='0.01' title='Value' placeholder='Value' value='1' />" : "<input id='frameValue' type='text' class='textfield' title='Value' placeholder='Value' />";
		
		Modal.confirm(
			"Add Frame Property Value",
			"Enter value to add to frame property "+name+".<br><br>"+input,
			(function() {
				let value = document.getElementById('frameValue').value;
				if(value != "" && value != null) {
					this.doAddFramePropertyValue(name, value);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"medium",
			false
		);
	}
	doAddFramePropertyValue(name, value, apply=true) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		if(apply) state.addFrameProperty(name, value);
		
		let container = document.getElementById('fprop_'+name).children[1].children[0].children[0];
		if(container == null) return false;
		let num = container.children.length;
		
		let newValue = document.createElement('div');
		newValue.dataset['number'] = num;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow');
		let label = document.createElement('label');
		label.classList.add('description');
		label.innerText = value;
		cell1.append(label);
		newValue.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Frame Property Value";
		button.dataset['action'] = "deleteFramePropertyValue";
		cell2.append(button);
		newValue.append(cell2);
		
		container.append(newValue);
	}
	removeFramePropertyValue(elem) {
		let name = elem.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.dataset['param']; //Button -> cell -> value -> container -> list -> cell -> frameProperty (with data)
		let num = parseInt(elem.parentElement.parentElement.dataset['number'])||0;
		
		Modal.confirm(
			"Delete Frame Property Value",
			"Are you sure you want to delete frame property value #"+(num+1)+"?",
			(function() {this.doRemoveFramePropertyValue(name, num); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"medium",
			true
		);
	}
	doRemoveFramePropertyValue(name, id) {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		state.removeFrameProperty(name, id);
		let container = document.getElementById('fprop_'+name).children[1].children[0].children[0]
		let elem = container.children[id];
		elem.remove();
		
		for(let i = 0; i < container.children; i++) {
			container.children[i].dataset['number'] = i;
		}
	}
	
	updateMode() {
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		let elem = document.getElementById('mode_content')
		let selected = parseInt(document.getElementById('mode').value)||0;
		elem.innerHTML = "";
		if(selected == State.TRANSITION) {
			let allStates = [];
			for(let i = 0; i < stateType.states.length; i++) {
				if(i != stateId) allStates.push(stateType.states[i].name);
			}
			
			let label = document.createElement('label');
			label.classList.add('description');
			label.innerText = "Transition:";
			elem.appendChild(label);
			
			let select = document.createElement('select');
			select.classList.add('modern', 'medium');
			select.id = "transition";
			select.addEventListener('change', this.updateSelect.bind(this));
			
			for(let i in allStates) {
				let option = document.createElement('option');
				option.value = allStates[i];
				option.innerText = allStates[i];
				if(state.transition == allStates[i]) option.selected = true;
				select.appendChild(option);
			}
			elem.appendChild(select);
		}
	}
	
	updateInput(e) {
		let elem = e.target;
		let id = elem.id;
		let value = elem.value;
		
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		switch(id) {
			case 'frames': state.frames = parseInt(value)||1; elem.value = state.frames; break;
			case 'cycle': state.cycle = parseFloat(value)||1.0; elem.value = state.cycle; break;
		}
	}
	updateSelect(e) {
		let elem = e.target;
		let id = elem.id;
		let value = elem.value;
		
		let stateTypeId = parseInt(this._content.children[0].dataset['stateTypeId'])||0;
		let stateId = parseInt(this._content.children[0].dataset['stateId'])||0;
		let stateType = animator._stateTypes[stateTypeId];
		let state = stateType.states[stateId];
		
		switch(id) {
			case 'transition': state.transition = value; break;
			case 'mode': state.mode = parseInt(value)||0; elem.value = state.mode; this.updateMode(); break;
			case 'default': stateType.default = value; break;
		}
	}
}

class ParticlesTab extends UITab {
	constructor(elem) {
		super(elem);
		this._animator = animator;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleInput = this.handleInput.bind(this);
		this._boundHandleChange = this.handleChange.bind(this);
		this._boundHandleDblClick = this.handleDblClick.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		
		this._boundBuildNavbar = this.buildNavbar.bind(this);
		this._boundBuildLayeredContent = this.buildLayeredContent.bind(this);
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('dblclick', this._boundHandleDblClick);
		this._content.innerHTML = '';
		this._animator.removeEventListener('load', this._boundBuildNavbar);
		this._animator.removeEventListener('load', this._boundBuildLayeredContent);
		this._animator = null;
		
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._animator.addEventListener('load', this._boundBuildNavbar);
		this._animator.addEventListener('load', this._boundBuildLayeredContent);
		this.buildNavbar();
		this.buildLayeredContent();
	}
	
	onUnload() {
		this._content.innerHTML = '';
		this._nests = [];
		this._animator.removeEventListener('load', this._boundBuildNavbar);
		this._animator.removeEventListener('load', this._boundBuildLayeredContent);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "BUTTON") return false;
		
		let action = target.dataset['action'];
		if(action == "addEmitter") this.addEmitter();
		else if(action == "editEmitter") this.editEmitter(target);
		else if(action == "deleteEmitter") this.removeEmitter(target);
		else if(action == "addParticle") this.addParticle();
		else if(action == "editParticle") this.editParticle(target);
		else if(action == "deleteParticle") this.removeParticle(target);
		else if(action == "addVariance") this.addVariance();
		else if(action == "deleteVariance") this.removeVariance(target);
		return true;
	}
	
	handleInput(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT" || target.type == "checkbox") return false;
		
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		
		let id = target.id, value = target.value, checked = target.checked || false;
		
		let emitter = this._animator._particleEmitters[eid];
		
		if(id == "burstcount") {emitter.burstCount = parseInt(value)||0; return true;}
		else if(id == "emissionrate") {emitter.emissionRate = parseInt(value)||0; return true;}
		
		let particle = emitter.particles[pid];
		
		switch(id) {
			case 'animation': particle.animation = value; break;
			case 'size': particle.size = value; break;
			case 'angularvelocity': particle.angularVelocity = value; break;
			case 'color1': case 'color2': case 'color3': case 'color4':
				particle.color = [
					document.getElementById('color1').value,
					document.getElementById('color2').value,
					document.getElementById('color3').value,
					document.getElementById('color4').value
				];
				break;
			case 'fade': particle.fade = value; break;
			case 'destructiontime': particle.destructionTime = value; break;
			case 'destructionaction': particle.destructionAction = value; break;
			case 'position1': case 'position2':
				particle.position = [
					document.getElementById('position1').value,
					document.getElementById('position2').value
				];
				break;
			case 'initialvelocity1': case 'initialvelocity2':
				particle.initialVelocity = [
					document.getElementById('initialvelocity1').value,
					document.getElementById('initialvelocity2').value
				];
				break;
			case 'finalvelocity1': case 'finalvelocity2':
				particle.finalVelocity = [
					document.getElementById('finalvelocity1').value,
					document.getElementById('finalvelocity2').value
				];
				break;
			case 'approach1': case 'approach2':
				particle.approach = [
					document.getElementById('approach1').value,
					document.getElementById('approach2').value
				];
				break;
			case 'layer': particle.layer = value; break;
			case 'timetolive': particle.timeToLive = value; break;
			
			case 'var_size1': particle.setVariance('size', value); break;
			case 'var_timeToLive1': particle.setVariance('timeToLive', value); break;
			case 'var_initialVelocity1': case 'var_initialVelocity2':
				particle.setVariance('initialVelocity', [
					document.getElementById('var_initialVelocity1').value,
					document.getElementById('var_initialVelocity2').value
				]);
				break;
		}
	}
	
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		if(target.parentElement.classList.contains('emitter')) this.renameEmitter(target);
		else if(target.parentElement.classList.contains('particle')) this.renameParticle(target);
	}
	
	handleChange(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "SELECT" && target.id != "flippable") return false;
		
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		
		let id = target.id, value = target.value, checked = target.checked || false;
		switch(id) {
			case 'anchorpart':
				this._animator._particleEmitters[eid].anchorPart = value;
				break;
			case 'type':
				this._animator._particleEmitters[eid]._particles[pid].type = value;
				if(value == "animated") document.getElementById('animation_row').classList.remove('hidden');
				else document.getElementById('animation_row').classList.add('hidden');
				break;
			case 'flippable':
				this._animator._particleEmitters[eid]._particles[pid].flippable = checked;
				break;
		}
	}
	
	buildLayeredContent(data = null) {
		this._content.innerHTML = '';
		
		if(data == null) this.loadMenu();
		else if(data.layer == 1) this.loadEmitter(data.id);
		else if(data.layer == 2) this.loadParticle(data.id, data.particleId);
		else this.loadMenu();
	}
	
	loadMenu() {
		this._contentElem = document.createElement('div');
		this._contentElem.classList.add('emitters');
		this._content.replaceChildren(this._contentElem);
		
		let warning = document.createElement('div');
		warning.classList.add('warning');
		warning.innerText = 'No particle emitters defined.';
		this._content.append(warning);
		
		let controls = document.createElement('div');
		controls.classList.add('sticky_controls');
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('modern', 'tiny');
		button.title = "Add new\nparticle emitter";
		button.innerText = '+';
		button.dataset['action'] = 'addEmitter';
		controls.append(button);
		this.content.append(controls);
		
		for(let i = 0; i < this._animator._particleEmitters.length; i++) {
			this.doAddEmitter(this._animator._particleEmitters[i].name, i);
		}
	}
	loadEmitter(eid) {
		this._contentElem = null;
		let template = document.getElementById('fragment_emitter').content;
		let clone = document.importNode(template, true);
		let emitter = this._animator._particleEmitters[eid];
		
		clone.children[0].dataset['id'] = eid;
		clone.children[0].dataset['name'] = this._animator._particleEmitters[eid].name;
		
		clone.getElementById('burstcount').value = emitter.burstCount;
		clone.getElementById('emissionrate').value = emitter.emissionRate;
		
		let select = clone.getElementById('anchorpart');
		let parts = [];
		for(let i = 0; i < this._animator._parts.length; i++) {
			parts.push(this._animator._parts[i].name);
		}
		parts.sort();
		for(let i = 0; i < parts.length; i++) {
			let option = document.createElement('option');
			option.value = parts[i];
			option.innerText = parts[i];
			select.append(option);
		}
		
		let inputs = clone.querySelectorAll('input');
		for(let i = 0; i < inputs.length; i++) {
			inputs[i].addEventListener('blur', this._boundHandleInput);
		}
		let selects = clone.querySelectorAll('select');
		for(let i = 0; i < selects.length; i++) {
			selects[i].addEventListener('change', this._boundHandleChange);
		}
		
		this._content.appendChild(clone);
		this._contentElem = document.getElementById('particlesList');
		
		for(let i = 0; i < emitter._particles.length; i++) {
			let isComplex = emitter._particles[i] instanceof ParticleAnimated;
			if(isComplex) this.doAddParticle(true, undefined, i);
			else this.doAddParticle(false, emitter._particles[i].name, i);
		}
	}
	loadParticle(eid, pid) {
		let template = document.getElementById('fragment_particle').content;
		let clone = document.importNode(template, true);
		let particle = this._animator._particleEmitters[eid]._particles[pid];
		
		clone.children[0].dataset['id'] = eid;
		clone.children[0].dataset['pid'] = pid;
		
		clone.getElementById('type').value = particle.type;
		clone.getElementById('type').addEventListener('change', this._boundHandleChange);
		clone.getElementById('animation').value = particle.animation;
		if(particle.type == "animated") clone.getElementById('animation_row').classList.remove('hidden');
		clone.getElementById('size').value = particle.size;
		clone.getElementById('angularvelocity').value = particle.angularVelocity;
		let color = particle.color;
		clone.getElementById('color1').value = color[0];
		clone.getElementById('color2').value = color[1];
		clone.getElementById('color3').value = color[2];
		clone.getElementById('color4').value = color[3];
		clone.getElementById('fade').value = particle.fade;
		clone.getElementById('destructiontime').value = particle.destructionTime;
		clone.getElementById('destructionaction').value = particle.destructionAction;
		let pos = particle.position;
		clone.getElementById('position1').value = pos[0];
		clone.getElementById('position2').value = pos[1];
		let iVel = particle.initialVelocity;
		clone.getElementById('initialvelocity1').value = iVel[0];
		clone.getElementById('initialvelocity2').value = iVel[1];
		let fVel = particle.finalVelocity;
		clone.getElementById('finalvelocity1').value = fVel[0];
		clone.getElementById('finalvelocity2').value = fVel[1];
		let app = particle.approach;
		clone.getElementById('approach1').value = app[0];
		clone.getElementById('approach2').value = app[1];
		clone.getElementById('layer').value = particle.layer;
		clone.getElementById('timetolive').value = particle.timeToLive;
		clone.getElementById('flippable').checked = particle.flippable;
		clone.getElementById('flippable').addEventListener('change', this._boundHandleChange);
		
		let enabled = particle.saveParameters;
		clone.getElementById('size_enabled').checked = enabled['size'];
		clone.getElementById('angularvelocity_enabled').checked = enabled['angularVelocity'];
		clone.getElementById('color_enabled').checked = enabled['color'];
		clone.getElementById('fade_enabled').checked = enabled['fade'];
		clone.getElementById('destructiontime_enabled').checked = enabled['destructionTime'];
		clone.getElementById('destructionaction_enabled').checked = enabled['destructionAction'];
		clone.getElementById('position_enabled').checked = enabled['position'];
		clone.getElementById('initialvelocity_enabled').checked = enabled['initialVelocity'];
		clone.getElementById('finalvelocity_enabled').checked = enabled['finalVelocity'];
		clone.getElementById('approach_enabled').checked = enabled['approach'];
		clone.getElementById('layer_enabled').checked = enabled['layer'];
		clone.getElementById('timetolive_enabled').checked = enabled['timeToLive'];
		
		let inputs = clone.querySelectorAll('input');
		for(let i = 0; i < inputs.length; i++) {
			inputs[i].addEventListener('blur', this._boundHandleInput);
		}
		let selects = clone.querySelectorAll('select, #flippable');
		for(let i = 0; i < selects.length; i++) {
			selects[i].addEventListener('change', this._boundHandleChange);
		}
		let checks = clone.querySelectorAll('input.checkbox:not(#flippable)');
		for(let i = 0; i < checks.length; i++) {
			checks[i].addEventListener('change', this.setEnabled.bind(this));
		}
		
		this._content.appendChild(clone);
		
		let variances = particle.variance;
		let allowed = ParticleAnimated.allowedVariance();
		for(let i in variances) {
			let val1 = "", val2 = "";
			let val = variances[i];
			if(allowed[i]) {val1 = val[0]; val2 = val[1];}
			else val1 = val;
			this.doAddVariance(i, val1, val2);
		}
	}
	
	setEnabled(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT" || !target.classList.contains('checkbox')) return false;
		
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		
		let id = target.id, checked = target.checked, t = target.dataset['target'];
		this._animator._particleEmitters[eid]._particles[pid].setSaveParameters(t, checked);
	}
	
	addEmitter() {
		Modal.confirm(
			"Add Particle Emitter",
			"Enter name of the new particle emitter.<br><br><input class='textfield large' type='text' id='emitterName' placeholder='Particle Emitter Name' />",
			(function() {
				let name = document.getElementById('emitterName').value;
				if(name != "") {
					this.checkAddEmitter(name);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddEmitter(name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._particleEmitters.length; i++) {
			if(this._animator._particleEmitters[i].name == name) {isTaken = true; break;}
		}
		
		if(isTaken) ToastModal.open("Emitter name taken", true);
		else this.doAddEmitter(name);
	}
	doAddEmitter(name, refId=-1) {
		if(refId==-1) this._animator.addParticleEmitter(name);
		let actRefId = refId==-1?this._animator._particleEmitters.length-1:refId;
		let emitter = this._animator._particleEmitters[actRefId];
		
		let newEmitter = document.createElement('div');
		newEmitter.classList.add('emitter');
		newEmitter.dataset['name'] = name;
		newEmitter.dataset['id'] = actRefId;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow', 'editable');
		cell1.innerText = name;
		newEmitter.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'right');
		cell2.innerHTML = "<span>Particles: "+emitter.particles.length+"</span>";
		newEmitter.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '✎';
		button.title = "Edit Emitter";
		button.dataset['action'] = "editEmitter";
		cell3.append(button);
		button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Emitter";
		button.dataset['action'] = "deleteEmitter";
		cell3.append(button);
		newEmitter.append(cell3);
		
		this._contentElem.append(newEmitter);
	}
	
	renameEmitter(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let id = parseInt(elem.parentElement.dataset['id'])||0;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "Emitter Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.checkRenameEmitter(id, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenameEmitter(id, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._particleEmitters.length; i++) {
			if(this._animator._particleEmitters[i].name == name) {isTaken = true; break;}
		}
		if(isTaken) {
			let orgName = this._contentElem.children[id].dataset['name'];
			this._contentElem.children[id].children[0].innerText = orgName;
			ToastModal.open("Emitter name taken", true);
		} else this.doRenameEmitter(id, name);
	}
	doRenameEmitter(id, name) {
		if(id < 0) return;
		
		this._contentElem.children[id].children[0].innerText = name;
		this._contentElem.children[id].dataset['name'] = name;
		this._animator._particleEmitters[id].name = name;
	}
	
	removeEmitter(elem) {
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> Emitter (with data)
		let id = parseInt(elem.parentElement.parentElement.dataset['id'])||0;
		
		Modal.confirm(
			"Delete Particle Emitter",
			"Are you sure you want to delete the particle emitter \""+name+"\"?",
			(function() {this.doRemoveEmitter(id); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveEmitter(id) {
		this._contentElem.children[id].remove();
		this._animator.removeParticleEmitter(id);
		
		for(let i = 0; i < this._contentElem.children.length; i++) {
			this._contentElem.children[i].dataset['id'] = i;
		}
	}
	
	editEmitter(elem) {
		let eid = parseInt(elem.parentElement.parentElement.dataset['id'])||0;
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> Emitter (with data)
		
		this.addNavigationLayer("Emitter: "+name, {layer: 1, id: eid});
	}
	
	addParticle() {
		Modal.confirm(
			"Add Particle",
			"Enter name of the new particle.<br><br>Leave empty to define one inline.<br><br><input class='textfield large' type='text' id='particleName' placeholder='Particle Name' />",
			(function() {
				let name = document.getElementById('particleName').value;
				if(name != "") {
					this.doAddParticle(false, name);
					return true;
				} else {
					this.doAddParticle(true);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	doAddParticle(isComplex, data, index = -1) {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let emitter = this._animator._particleEmitters[eid];
		if(index == -1) {emitter.addParticle(isComplex, data); index = emitter._particles.length-1;}
		let particle = emitter._particles[index];
		
		let newParticle = document.createElement('div');
		newParticle.classList.add('particle');
		newParticle.dataset['id'] = this._contentElem.children.length;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow');
		if(!isComplex) {
			cell1.classList.add('editable');
			cell1.innerText = String(data);
			newParticle.dataset['name'] = String(data);
		} else cell1.innerText = 'Custom Particle';
		newParticle.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'grow', 'right');
		if(isComplex) cell2.innerText = particle.type;
		newParticle.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		if(isComplex) {
			button.classList.add('modern', 'tiny');
			button.innerText = '✎';
			button.title = "Edit Particle";
			button.dataset['action'] = "editParticle";
			cell3.append(button);
			button = document.createElement('button');
		}
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Particle";
		button.dataset['action'] = "deleteParticle";
		cell3.append(button);
		newParticle.append(cell3);
		
		this._contentElem.append(newParticle);
	}
	
	editParticle(elem) {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> particle (with data)
		
		this.addNavigationLayer("Particle #"+(pid+1), {layer: 2, id: eid, particleId: pid});
	}
	
	renameParticle(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(elem.parentElement.dataset['id'])||0;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "Particle Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.doRenameParticle(eid, pid, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	doRenameParticle(eid, pid, name) {
		if(eid < 0 || pid < 0) return;
		
		this._contentElem.children[pid].children[0].innerText = name;
		this._animator._particleEmitters[eid]._particles[pid].name = name;
	}
	
	removeParticle(elem) {
		let index = parseInt(elem.parentElement.parentElement.dataset['id'])||0; // Button -> cell -> particle (with data)
		
		Modal.confirm(
			"Delete Particle",
			"Are you sure you want to delete particle #"+(index+1)+"?",
			(function() {this.doRemoveParticle(index); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveParticle(index) {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let emitter = this._animator._particleEmitters[eid];
		
		emitter.removeParticle(index);
		this._contentElem.children[index].remove();
		
		for(let i = 0; i < this._contentElem.children.length; i++) {this._contentElem.children[i].dataset['id'] = i;}
	}
	
	addVariance() {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		let particle = this._animator._particleEmitters[eid]._particles[pid];
		let variances = particle.variance;
		let allowed = ParticleAnimated.allowedVariance();
		
		let options = "";
		for(let i in allowed) {
			if(!Object.hasOwn(variances, i) && document.getElementById('var_'+i) == null) options += "<option value=\""+i+"\">"+i+"</option>";
		}
		
		Modal.confirm(
			"Add Variance",
			"Select variance to add.<br><br><select class='modern large' id='variance'>"+options+"</select>",
			(function() {
				let value = document.getElementById('variance').value;
				if(value != "" && value != null) {
					this.checkAddVariance(value);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddVariance(name = null) {
		if(name == null) return;
		
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		let particle = this._animator._particleEmitters[eid]._particles[pid];
		
		if(!Object.hasOwn(ParticleAnimated.allowedVariance(), name)) {ToastModal.open("Invalid variance", true); return;}
		
		if(document.getElementById('var_'+name) != null) ToastModal.open("Variance already set", true);
		else this.doAddVariance(name);
	}
	doAddVariance(name, val1 = "", val2 = "") {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		let particle = this._animator._particleEmitters[eid]._particles[pid];
		let varTypes = ParticleAnimated.allowedVariance();
		
		let newVariance = document.createElement('div');
		newVariance.classList.add('variance');
		newVariance.id = "var_"+name;
		newVariance.dataset['param'] = name;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow');
		let label = document.createElement('label');
		label.classList.add('description');
		label.innerText = name+":";
		cell1.append(label);
		let input = document.createElement('input');
		input.classList.add('textfield', 'tiny');
		input.type = "number";
		input.step = "0.01";
		input.placeholder = "Val 1";
		input.title = name+" - Val 1";
		input.id = "var_"+name+"1";
		input.value = val1;
		input.addEventListener('blur', this._boundHandleInput);
		cell1.append(input);
		if(varTypes[name]) {
			let filler = document.createTextNode("\n");
			cell1.append(filler);
			input = document.createElement('input');
			input.classList.add('textfield', 'tiny');
			input.type = "number";
			input.step = "0.01";
			input.placeholder = "Val 2";
			input.title = name+" - Val 2";
			input.id = "var_"+name+"2";
			input.value = val2;
			input.addEventListener('blur', this._boundHandleInput);
			cell1.append(input);
		}
		newVariance.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Variance";
		button.dataset['action'] = "deleteVariance";
		cell2.append(button);
		newVariance.append(cell2);
		
		document.getElementById('variances').append(newVariance);
	}
	
	removeVariance(elem) {
		let name = elem.parentElement.parentElement.dataset['param'];
		
		Modal.confirm(
			"Delete Variance",
			"Are you sure you want to delete variance "+name+"?",
			(function() {this.doRemoveVariance(name); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveVariance(name) {
		let eid = parseInt(this._content.children[0].dataset['id'])||0;
		let pid = parseInt(this._content.children[0].dataset['pid'])||0;
		let particle = this._animator._particleEmitters[eid]._particles[pid];
		
		particle.removeVariance(name);
		
		document.getElementById('var_'+name).remove();
	}
}

class GroupsTab extends UITab {
	constructor(elem) {
		super(elem);
		this._animator = animator;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleDblClick = this.handleDblClick.bind(this);
		this._boundHandleChange = this.handleChange.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		this._content.addEventListener('change', this._boundHandleChange);
		
		this._boundUpdateView = this.updateView.bind(this);
		
		this._groupsElem = this._content.querySelector('.groups');
		
		this._groups = [];
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('dblclick', this._boundHandleDblClick);
		this._content.removeEventListener('change', this._boundHandleChange);
		this._animator.removeEventListener('load', this._boundUpdateView);
		this._groupsElem.innerHTML = '';
		this._group = [];
		this._animator = null;
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._animator.addEventListener('load', this._boundUpdateView);
		this.updateView();
	}
	
	onUnload() {
		this._groupsElem.innerHTML = '';
		this._groups = [];
		this._animator.removeEventListener('load', this._boundUpdateView);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "BUTTON") return false;
		
		let action = target.dataset['action'];
		if(action == "addGroup") this.addGroup();
		else if (action == "deleteGroup") this.removeGroup(target);
		return true;
	}
	
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		this.renameGroup(target);
	}
	
	handleChange(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT" || target.type != "checkbox") return false;
		
		let id = parseInt(target.parentElement.parentElement.parentElement.dataset['id']) || 0;
		if(id == -1) return false;
		
		let checked = !!target.checked;
		this._animator._transformationGroups[id].setParameter('interpolated', checked);
		return true;
	}
	
	addGroup() {
		Modal.confirm(
			"Add Transform. Group",
			"Enter name of the new transformation group.<br><br><input class='textfield large' type='text' id='groupName' placeholder='Transform. Group Name' />",
			(function() {
				let name = document.getElementById('groupName').value;
				if(name != "") {
					this.checkAddGroup(name);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddGroup(name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._transformationGroups.length; i++) {
			if(this._animator._transformationGroups[i].name == name) {isTaken = true; break;}
		}
		
		if(isTaken) ToastModal.open("Group name taken", true);
		else this.doAddGroup(name);
	}
	doAddGroup(name, apply=true) {
		let id = this._groups.length;
		
		let newGroup = document.createElement('div');
		newGroup.classList.add('group');
		newGroup.dataset['name'] = name;
		newGroup.dataset['id'] = id;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'editable');
		cell1.innerText = name;
		newGroup.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'grow', 'right');
		cell2.append('Interpolated: ');
		let label = document.createElement('label');
		label.classList.add('switch');
		label.setAttribute('for', 'group_switch_'+id);
		label.title = "Toggle interpolation\nfor this group";
		let input = document.createElement('input');
		input.type = "checkbox";
		input.classList.add('checkbox');
		input.id = 'group_switch_'+id;
		input.value = "1";
		label.append(input);
		let span = document.createElement('span');
		span.classList.add('slider', 'round');
		label.append(span);
		cell2.append(label);
		newGroup.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Transformation\nGroup";
		button.dataset['action'] = "deleteGroup";
		cell3.append(button);
		newGroup.append(cell3);
		
		this._groupsElem.append(newGroup);
		this._groups.push(name);
		
		if(apply) animator.addTransformationGroup(name, {interpolated: false});
	}
	
	renameGroup(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let id = this._groups.indexOf(orgValue);
		if(id == -1) return;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "Group Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.checkRenameGroup(id, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenameGroup(id, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._transformationGroups.length; i++) {
			if(this._animator._groupsElem[i].name == name) {isTaken = true; break;}
		}
		if(isTaken) {
			let orgName = this._groupsElem.children[id].dataset['name'];
			this._groupsElem.children[id].children[0].innerText = orgName;
			ToastModal.open("Group name taken", true);
		} else this.doRenameGroup(id, name);
	}
	doRenameGroup(id, name) {
		if(id < 0) return;
		
		this._groupsElem.children[id].children[0].innerText = name;
		this._groupsElem.children[id].dataset['name'] = name;
		this._animator._transformationGroups[id].name = name;
	}
	
	removeGroup(elem) {
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> Group (with data)
		let id = this._groups.indexOf(name);
		if(id == -1) return;
		
		Modal.confirm(
			"Delete Tranform. Group",
			"Are you sure you want to delete the transformation group \""+name+"\"?",
			(function() {this.doRemoveGroup(id); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveGroup(id) {
		this._groupsElem.children[id].remove();
		this._animator.removeTransformationGroup(id);
		this._groups.splice(id, 1);
		
		for(let i = 0; i < this._groupsElem.children.length; i++) {
			this._groupsElem.children[i].dataset['id'] = i;
			this._groupsElem.children[i].children[1].children[0].setAttribute('for', 'group_switch_'+i);
			this._groupsElem.children[i].children[1].children[0].children[0].id = 'group_switch_'+i;
		}
	}
	
	updateView() {
		this._groupsElem.innerHTML = "";
		for(let i in this._animator._transformationGroups) {
			this.doAddGroup(this._animator._transformationGroups[i].name, false);
			if(this._animator._transformationGroups[i].getParameter('interpolated')) {
				this._groupsElem.children[i].children[1].children[0].children[0].checked = true;
			}
		}
	}
}

class SoundsTab extends UITab {
	constructor(elem) {
		super(elem);
		this._animator = animator;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleDblClick = this.handleDblClick.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		
		this._boundUpdateView = this.updateView.bind(this);
		
		this._poolsElem = this._content.querySelector('.sounds');
		
		this._pools = [];
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('click', this._boundHandleDblClick);
		this._animator.removeEventListener('load', this._boundUpdateView);
		this._poolsElem.innerHTML = '';
		this._pools = [];
		this._animator = null;
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._animator.addEventListener('load', this._boundUpdateView);
		this.updateView();
	}
	
	onUnload() {
		this._poolsElem.innerHTML = '';
		this._pools = [];
		this._animator.removeEventListener('load', this._boundUpdateView);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		
		if(target.tagName == "BUTTON") {
			let action = target.dataset['action'];
			if(action == "addPool") this.addPool();
			else if(action == "deletePool") this.removePool(target);
			else if(action == "addSound") this.addSound(target);
			else if(action == "deleteSound") this.removeSound(target);
			return true;
		} else if(target.classList.contains('indicator')) this.toggleOpen(target);
		
		return true;
	}
	
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		this.renamePool(target);
	}
	
	addPool() {
		Modal.confirm(
			"Add Sound Pool",
			"Enter name of the new sound pool.<br><br><input class='textfield large' type='text' id='poolName' placeholder='Sound Pool Name' />",
			(function() {
				let name = document.getElementById('poolName').value;
				if(name != "") {
					this.checkAddPool(name);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	checkAddPool(name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._sounds.length; i++) {
			if(this._animator._sounds[i].name == name) {isTaken = true; break;}
		}
		
		if(isTaken) ToastModal.open("Pool name taken", true);
		else this.doAddPool(name);
	}
	doAddPool(name, apply=true) {
		let newPool = document.createElement('div');
		newPool.classList.add('pool');
		newPool.dataset['name'] = name;
		newPool.dataset['id'] = this._pools.length;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'indicator');
		newPool.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'editable');
		cell2.innerText = name;
		newPool.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'grow', 'right');
		cell3.innerText = "Sounds: 0";
		newPool.append(cell3);
		
		let cell4 = document.createElement('div');
		cell4.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Sound Pool";
		button.dataset['action'] = "deletePool";
		cell4.append(button);
		newPool.append(cell4);
		
		this._poolsElem.append(newPool);
		this._pools.push(name);
		
		if(apply) animator.addSoundPool(name);
	}
	
	renamePool(elem) {
		let orgValue = elem.parentElement.dataset['name'];
		let id = this._pools.indexOf(orgValue);
		if(id == -1) return;
		
		let input = document.createElement('input');
		input.type = "text";
		input.classList.add('textfield', 'large');
		input.placeholder = "Pool Name";
		input.value = orgValue;
		let self = this;
		input.addEventListener('blur', function() {
			let name = this.value;
			if(name == orgValue || name == "") this.parentElement.innerText = orgValue;
			else self.checkRenamePool(id, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenamePool(id, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._sounds.length; i++) {
			if(this._animator._sounds[i].name == name) {isTaken = true; break;}
		}
		if(isTaken) {
			let orgName = this._poolsElem.children[id].dataset['name'];
			this._poolsElem.children[id].children[1].innerText = orgName;
			ToastModal.open("Pool name taken", true);
		} else this.doRenamePool(id, name);
	}
	doRenamePool(id, name) {
		if(id < 0) return;
		
		this._poolsElem.children[id].children[1].innerText = name;
		this._poolsElem.children[id].dataset['name'] = name;
		this._animator._sounds[id].name = name;
	}
	
	removePool(elem) {
		let name = elem.parentElement.parentElement.dataset['name']; // Button -> Cell -> Pool (with data)
		let id = this._pools.indexOf(name);
		if(id == -1) return;
		
		Modal.confirm(
			"Delete Sound Pool",
			"Are you sure you want to delete the sound pool \""+name+"\"?",
			(function() {this.doRemovePool(id); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemovePool(id) {
		this._poolsElem.children[id].remove();
		this._animator.removeSoundPool(id);
		this._pools.splice(id, 1);
		
		for(let i = 0; i < this._poolsElem.children.length; i++) {
			this._poolsElem.children[i].dataset['id'] = i;
		}
	}
	
	toggleOpen(elem) {
		let parent = elem.parentElement;
		let isOpen = parent.classList.contains('open');
		if(isOpen) parent.children[2].innerText = "Sounds: "+this._animator._sounds[parent.dataset['id']].list.length;
		else {
			let target = parent.children[2];
			
			let newElem = document.createElement('div');
			newElem.classList.add('sounds');
			target.replaceChildren(newElem);
			let list = newElem;
			
			newElem = document.createElement('div');
			newElem.classList.add('warning');
			newElem.append("No sounds in this pool.");
			target.append(newElem);
			
			newElem = document.createElement('div');
			newElem.classList.add('non_sticky_controls');
			let button = document.createElement('button');
			button.classList.add('modern', 'tiny');
			button.dataset['action'] = "addSound";
			button.type = "button";
			button.title = "Add new sound\nto this pool";
			button.innerText = '+';
			newElem.append(button);
			target.append(newElem);
			
			let id = parseInt(parent.dataset['id']) || 0;
			
			for(let i = 0; i < this._animator._sounds[id].list.length; i++) {
				let sound = this._animator._sounds[id].list[i];
				
				let newSound = document.createElement('div');
				newSound.classList.add('sound');
				newSound.dataset['id'] = i;
				
				let cell1 = document.createElement('div');
				cell1.classList.add('cell', 'grow');
				cell1.innerText = sound;
				newSound.append(cell1);
				
				let cell2 = document.createElement('div');
				cell2.classList.add('cell', 'controls', 'hover');
				button = document.createElement('button');
				button.classList.add('modern', 'tiny');
				button.innerText = '-';
				button.title = "Remove Sound from Pool";
				button.dataset['action'] = "deleteSound";
				cell2.append(button);
				newSound.append(cell2);
				
				list.append(newSound);
			}
		}
		
		parent.classList.toggle('open');
	}
	
	addSound(elem) {
		let id = parseInt(elem.parentElement.parentElement.parentElement.dataset['id']) || 0; // Button -> container -> cell -> pool (with data)
		let name = elem.parentElement.parentElement.parentElement.dataset['name'];
		Modal.confirm(
			"Add Sound to Pool",
			"Enter sound name to add to the sound pool \""+name+"\".<br><br><input class='textfield large' type='text' id='soundName' placeholder='Sound Name' />",
			(function() {
				let val = document.getElementById('soundName').value;
				if(name != "") {
					this.doAddSound(id, val);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"medium",
			false
		);
	}
	doAddSound(poolId, value, apply=true) {
		this._animator._sounds[poolId].add(value);
		let container = this._poolsElem.children[poolId];
		if(!container.classList.contains('open')) container.children[2].innerText = "Sounds: "+this._animator._sounds[poolId].list.length;
		else {
			let list = container.children[2].children[0];
			let newSound = document.createElement('div');
			newSound.classList.add('sound');
			newSound.dataset['id'] = (this._animator._sounds[poolId].list.length - 1);
			
			let cell1 = document.createElement('div');
			cell1.classList.add('cell', 'grow');
			cell1.innerText = value;
			newSound.append(cell1);
			
			let cell2 = document.createElement('div');
			cell2.classList.add('cell', 'controls', 'hover');
			let button = document.createElement('button');
			button.classList.add('modern', 'tiny');
			button.innerText = '-';
			button.title = "Remove Sound from Pool";
			button.dataset['action'] = "deleteSound";
			cell2.append(button);
			newSound.append(cell2);
			
			list.append(newSound);
		}
	}
	
	removeSound(elem) {
		let index = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> sound (with data)
		let parent = elem.parentElement.parentElement.parentElement.parentElement.parentElement // Button -> cell -> sound -> sound list -> cell -> pool (with data)
		let poolIndex = parseInt(parent.dataset['id']) || 0;
		let name = parent.dataset['name'];
		
		Modal.confirm(
			"Delete Sound from Pool",
			"Are you sure you want to delete sound pool \""+name+"\" entry #"+(index+1)+"?",
			(function() {this.doRemoveSound(poolIndex, index); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveSound(poolId, index) {
		this._animator._sounds[poolId].remove(index);
		let container = this._poolsElem.children[poolId];
		if(!container.classList.contains('open')) container.children[2].innerText = "Sounds: "+this._animator._sounds[poolId].list.length;
		else {
			let list = container.children[2].children[0];
			list.children[index].remove();
			
			for(let i = 0; i < list.children.length; i++) {list.children[i].dataset['id'] = i;}
		}
	}
	
	updateView() {
		this._poolsElem.innerHTML = "";
		for(let i in this._animator._sounds) {
			this.doAddPool(this._animator._sounds[i].name, false);
			for(let j = 0; j < this._animator._sounds[i].list.length; j++) {
				this.doAddSound(i, this._animator._sounds[i].list[j], false);
			}
		}
	}
}