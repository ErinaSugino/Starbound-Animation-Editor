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
		let cur = this._nests.length - 1;
		let startIndex = Math.max(cur - depth, 0);
		if(startIndex == 0) this._nests = [];
		else this._nests.splice(startIndex);
		
		let data = (this._nests[Math.max(this._nests.length, 0)] || {}).data || null;
		this.buildNavbar();
		this.buildLayeredContent(data);
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
		navelem.dataset['depth'] = highest;
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
	
	onLoad() {if(this._active) return; this._tab.classList.add('active'); this._active = true;}
	onUnload() {if(!this._active) return; this._tab.classList.remove('active'); this._active = false;}
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
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('dblclick', this._boundHandleDblClick);
		this._content.addEventListener('change', this._boundHandleChange);
		this._content.innerHTML = '';
		this._contentList = [];
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
			if(action == "addStateType") this.addStateType();
			else if(action == "deleteStateType") this.removeStateType(target);
			else if(action == "addState") this.addState(target);
			else if(action == "deleteState") this.removeState(target);
			else if(action == "editState") this.openState(target);
			return true;
		} else if(target.classList.contains('indicator')) this.toggleOpen(target);
		
		return true;
	}
	handleDblClick(e) {
		let target = e.target;
		if(target == null) return false;
		if(!target.classList.contains('editable')) return false;
		
		this.renameStateType(target);
	}
	handleChange(e) {
		
	}
	
	buildLayeredContent(data = null) {
		this._content.innerHTML = '';
		this._contentList = [];
		
		if(data == null) this.loadList();
		else this.loadMenu(data.id, data.refId);
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
			this.doAddStateType(this._animator._stateTypes[i].name, false);
			
			for(let j = 0; j < this._animator._stateTypes[i].states.length; j++) {
				this.doAddState(i, this._animator._stateTypes[i].states[j].name, false);
			}
		}
	}
	loadMenu(id, refId) {
		this._contentElem = null;
		this._content.innerHTML = 'Here would be your data';
	}
	
	openState(elem) {
		let stateId = parseInt(elem.parentElement.parentElement.dataset['id']) || 0; // Button -> cell -> state (with data)
		let stateTypeId = parseInt(elem.parentElement.parentElement.parentElement.parentElement.parentElement.dataset['id']) || 0; // Button -> cell -> state -> state list -> cell -> state type (with data)
		let name = this._animator._stateTypes[stateTypeId].states[stateId].name;
		
		this.addNavigationLayer("State: "+name, {id: stateTypeId, refId: stateId});
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
	doAddStateType(name, apply=true) {
		let id = this._contentList.length;
		
		let newStateType = document.createElement('div');
		newStateType.classList.add('stateType');
		newStateType.dataset['name'] = name;
		newStateType.dataset['id'] = id;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'indicator');
		newStateType.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'editable');
		cell2.innerText = name;
		newStateType.append(cell2);
		
		let cell3 = document.createElement('div');
		cell3.classList.add('cell', 'grow', 'right');
		cell3.innerText = "States: 0";
		newStateType.append(cell3);
		
		let cell4 = document.createElement('div');
		cell4.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove State Type";
		button.dataset['action'] = "deleteStateType";
		cell4.append(button);
		newStateType.append(cell4);
		
		this._contentElem.append(newStateType);
		this._contentList.push(name);
		
		if(apply) animator.addStateType(name);
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
			if(name == orgValue) this.parentElement.innerText = orgValue;
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
			ToastModal.open("Pool name taken", true);
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
			"Are you sure you want to delete the state type \""+name+"\"?\n\n<b>Every state and every part state associated with it will be removed too!</b>",
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
		if(isOpen) parent.children[2].innerText = "States: "+this._animator._stateTypes[parent.dataset['id']].states.length;
		else {
			let target = parent.children[2];
			
			let newElem = document.createElement('div');
			newElem.classList.add('sounds');
			target.replaceChildren(newElem);
			let list = newElem;
			
			newElem = document.createElement('div');
			newElem.classList.add('warning');
			newElem.append("No states in this pool.");
			target.append(newElem);
			
			newElem = document.createElement('div');
			newElem.classList.add('non_sticky_controls');
			let button = document.createElement('button');
			button.classList.add('modern', 'tiny');
			button.dataset['action'] = "addState";
			button.type = "button";
			button.title = "Add new sound\nto this pool";
			button.innerText = '+';
			newElem.append(button);
			target.append(newElem);
			
			let id = parseInt(parent.dataset['id']) || 0;
			
			for(let i = 0; i < this._animator._stateTypes[id].states.length; i++) {
				let state = this._animator._stateTypes[id].states[i];
				
				let newState = document.createElement('div');
				newState.classList.add('state');
				newState.dataset['id'] = i;
				
				let cell1 = document.createElement('div');
				cell1.classList.add('cell', 'grow');
				cell1.innerText = state.name;
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
				button = document.createElement('button');
				button.classList.add('modern', 'tiny');
				button.innerText = '-';
				button.title = "Remove State\nfrom State Type";
				button.dataset['action'] = "deleteState";
				cell3.append(button);
				button = document.createElement('button');
				button.classList.add('modern', 'tiny');
				button.innerText = '✎';
				button.title = 'Edit State';
				button.dataset['action'] = "editState";
				cell3.append(button);
				newState.append(cell3);
				
				list.append(newState);
			}
		}
		
		parent.classList.toggle('open');
	}
	
	addState(elem) {
		let id = parseInt(elem.parentElement.parentElement.parentElement.dataset['id']) || 0; // Button -> container -> cell -> state type (with data)
		let name = elem.parentElement.parentElement.parentElement.dataset['name'];
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
	doAddState(typeId, value, apply=true) {
		if(apply) this._animator._stateTypes[typeId].addState(value);
		let container = this._contentElem.children[typeId];
		if(!container.classList.contains('open')) container.children[2].innerText = "States: "+this._animator._stateTypes[typeId].states.length;
		else {
			let list = container.children[2].children[0];
			let newState = document.createElement('div');
			newState.classList.add('state');
			newState.dataset['id'] = (this._animator._stateTypes[typeId].states.length - 1);
			
			let cell1 = document.createElement('div');
			cell1.classList.add('cell', 'grow');
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
			button = document.createElement('button');
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
			
			list.append(newState);
		}
	}
	
	removeState(elem) {
		let index = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> state (with data)
		let parent = elem.parentElement.parentElement.parentElement.parentElement.parentElement // Button -> cell -> sound -> sound list -> cell -> pool (with data)
		let poolIndex = parseInt(parent.dataset['id']) || 0;
		let name = parent.dataset['name'];
		
		Modal.confirm(
			"Delete State from Type",
			"Are you sure you want to delete state type \""+name+"\" state #"+(index+1)+"?\n\n<b>This will remove every part state data associated with it!</b>",
			(function() {this.doRemoveState(poolIndex, index); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveState(typeId, index) {
		this._animator._stateTypes[typeId].removeState(index);
		let container = this._contentElem.children[typeId];
		if(!container.classList.contains('open')) container.children[2].innerText = "States: "+this._animator._stateTypes[typeId].states.length;
		else {
			let list = container.children[2].children[0];
			list.children[index].remove();
			
			for(let i = 0; i < list.children.length; i++) {list.children[i].dataset['id'] = i;}
		}
	}
}

class ParticlesTab extends UITab {
	
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
			if(name == orgValue) this.parentElement.innerText = orgValue;
			else self.checkRenameGroup(id, name);
		});
		input.addEventListener('keydown', function(e) {if(e.key == "Enter") this.blur();});
		elem.replaceChildren(input);
		input.focus();
	}
	checkRenameGroup(id, name) {
		let isTaken = false;
		for(let i = 0; i < this._animator._transformationGroups.length; i++) {
			if(this._animator._sounds[i].name == name) {isTaken = true; break;}
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
		button.dataset['action'] = "deleteTag";
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
			if(name == orgValue) this.parentElement.innerText = orgValue;
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