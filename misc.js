/** MODAL STUFF */
var Modal = {
	openModals: 0,
	isOpen: false,
	modalId: 0,
	
	closerCode: "<div class='modal_footer'><button class='modern normal confirm' onclick='{CONFIRM_CALLBACK}'>{CONFIRM_TEXT}</button>&emsp;-&emsp;<button class='modern normal cancle' onclick='{CANCLE_CALLBACK}'>{CANCLE_TEXT}</button></div>",
	modalCode: "<div class='modal {SIZE}{CLASS}'><div class='modal_title'>{TITLE}</div><div class='modal_content'>{CONTENT}</div>{CLOSER}</div>",
	overlayCode: "<div class='overlay' id='overlay'>{CONTENT}</div>",
	
	open: function(title, content, size = 'medium', closer = true, red = false) {
		this.modalId++;
		if(!size.toLowerCase().match(/small|medium|large/)) size = 'medium';
		let c = red ? ' red' : '';
		c += closer ? '' : ' noClose';
		let fetched = this.modalCode.replace(/\{CONTENT\}/, content).replace(/\{TITLE\}/, title).replace(/\{SIZE\}/, size).replace(/\{CLASS\}/, c);
		fetched = fetched.replace(/\{CLOSER\}/, '');
		if(this.isOpen) this.appendOverlay(fetched);
		else this.openOverlay(fetched);
		return true;
	},
	confirm: function(title, content, confirmCallback, cancleCallback = null, confirmText = "Confirm", cancleText = "Cancle", size = "medium", red = false, allowBlurClose = true) {
		this.modalId++;
		let modal = document.createElement('div');
		if(!size.toLowerCase().match(/small|medium|large/)) size = 'medium';
		modal.classList.add('modal', size, 'confirm');
		if(!allowBlurClose) modal.classList.add('noClose');
		if(red) modal.classList.add('red');
		
		let titleElem = document.createElement('div');
		titleElem.classList.add('modal_title');
		titleElem.innerText = title;
		modal.append(titleElem);
		
		let body = document.createElement('div');
		body.classList.add('modal_content');
		body.innerHTML = content;
		modal.append(body);
		
		let footer = document.createElement('div');
		footer.classList.add('modal_footer');
		
		let confirmButton = document.createElement('button');
		confirmButton.classList.add('modern', 'normal', 'confirm');
		confirmButton.innerText = confirmText;
		confirmButton.addEventListener('click', function(e){
			let cont = false;
			try {cont = confirmCallback();} catch(err) {console.error(err);}
			if(cont) Modal.manClose();
		});
		footer.append(confirmButton);
		
		footer.append(" - ");
		
		let cancleButton = document.createElement('button');
		cancleButton.classList.add('modern', 'normal', 'cancle');
		cancleButton.innerText = cancleText;
		cancleButton.addEventListener('click', function(e){
			let cont = true;
			try {if(cancleCallback != null) cont = cancleCallback();} catch(err) {console.error(err);}
			if(cont) Modal.manClose();
		});
		modal.addEventListener('modalblur', function(e){
			let cont = true;
			try {if(cancleCallback != null) cont = cancleCallback();} catch(err) {console.error(err);}
			if(cont) Modal.manClose();
		});
		footer.append(cancleButton);
		modal.append(footer);
		if(this.isOpen) this.appendOverlayHtml(modal);
		else this.openOverlayHtml(modal);
		return true;
	},
	checkClose: function(e) {
		let elem = document.querySelector('#overlay .modal:first-child')
		if(elem.classList.contains('noClose')) return;
		if(elem.classList.contains('confirm')) {
			let ev = new CustomEvent('modalblur', {bubble: false});
			elem.dispatchEvent(ev);
		} else this.manClose();
	},
	manClose: function() {
		if(this.openModals <= 1) {
			let elem = document.getElementById('overlay');
			elem.addEventListener('transitionend', function(){this.remove();}, {once: true});
			elem.style['opacity'] = 0;
			elem.style['pointer-events'] = 'none';
			this.openModals = 0;
			this.isOpen = false;
		} else {
			let elem = document.querySelector('#overlay .modal:first-child');
			elem.addEventListener('transitionend', function(e) {
				this.remove();
				let newModal = document.querySelector('#overlay .modal:first-child');
				newModal.style['opacity'] = 1;
				newModal.style['pointer-events'] = 'initial';
			}, {once: true});
			elem.style['opacity'] = 0;
			this.openModals--;
		}
	},
	
	openOverlay: function(content) {
		if(document.getElementById('overlay')) return;
		document.querySelector('div.body').insertAdjacentHTML('beforeend', this.overlayCode.replace(/\{CONTENT\}/, content));
		let elem = document.getElementById('overlay');
		elem.addEventListener('click', function(e){
			if(e.target.id.startsWith('omCloser') || e.target == document.getElementById('overlay')) Modal.checkClose(e);
		})
		elem.offsetWidth;
		elem.style['opacity'] = 1;
		elem = elem.querySelector('.modal:first-child');
		elem.style['opacity'] = 1;
		elem.style['pointer-events'] = 'initial';
		this.isOpen = true;
		this.openModals++;
	},
	appendOverlay: function(content) {
		let overlay = document.getElementById('overlay');
		if(!overlay) return;
		overlay.insertAdjacentHTML('beforeend', content);
		this.openModals++;
	},
	
	openOverlayHtml: function(elem) {
		if(document.getElementById('overlay')) return;
		let overlay = document.createElement('div');
		overlay.classList.add('overlay');
		overlay.id = "overlay";
		
		overlay.addEventListener('click', function(e) {
			if(e.target.id.startsWith('omCloser') || e.target == document.getElementById('overlay')) Modal.checkClose(e);
		});
		overlay.append(elem);
		document.querySelector('div.body').append(overlay);
		overlay.offsetWidth;
		overlay.style['opacity'] = 1;
		let sub = overlay.querySelector('.modal:first-child');
		sub.style['opacity'] = 1;
		sub.style['pointer-events'] = 'initial';
		this.isOpen = true;
		this.openModals++;
	},
	appendOverlayHtml: function(elem) {
		let overlay = document.getElementById('overlay');
		if(!overlay) return;
		overlay.append(elem);
		this.openModals++;
	}
};
var ToastModal = {
	openModalsCount: 0,
	openModals: {},
	pendingModals: [],
	modalId: 0,
	
	modalCode: "<div class='toast_modal {CLASS}{COLOR}' id='toastModal{ID}'><span>{CONTENT}</span></div>",
	
	open: function(content, red = false, time = 5000) {
		this.modalId++;
		let fetched = this.modalCode.replace(/\{CONTENT\}/, content).replace(/\{ID\}/, this.modalId).replace(/\{COLOR\}/, (red ? ' red' : ''));
		if(this.openModalsCount < 3) {
			this.appendToast(fetched);
			let id = this.modalId;
			let timer = null;
			if(time > 0) timer = setTimeout(function(){ToastModal.checkClose(id);}, time);
			this.openModals[this.modalId] = {elem: document.getElementById('toastModal'+this.modalId), timer: timer};
		} else this.pendingModals.push({code: fetched, time: time, id: this.modalId});
		return this.modalId;
	},
	checkClose: function(id) {
		if(this.openModals[id]) {
			let slot = parseInt(this.openModals[id].elem.dataset['slot']);
			let toast = this.openModals[id].elem;
			toast.style['opacity'] = 0;
			setTimeout(function(){
				toast.remove();
				for(let i = (slot+1); i > 1 && i <= 3; i++) {
					let elem = document.querySelector('div.toast_modal.slot'+i);
					if(!elem) continue;
					elem.classList.remove('slot'+i);
					elem.classList.add('slot'+(i-1));
					elem.dataset['slot'] = (i-1);
				}
			}, 500);
			delete this.openModals[id];
			this.openModalsCount--;
		}
		if(this.openModalsCount < 3 && this.pendingModals.length > 0) {
			let newModal = this.pendingModals.shift();
			this.appendToast(newModal.code);
			let timer = null;
			if(newModal.time > 0) timer = setTimeout(function(){ToastModal.checkClose(newModal.id);}, newModal.time);
			this.openModals[newModal.id] = {elem: document.getElementById('toastModal'+newModal.id), timer: timer};
		}
	},
	
	appendToast: function(code) {
		if(this.openModalsCount >= 3) return;
		code = code.replace(/\{CLASS\}/, 'slot'+(this.openModalsCount+1));
		document.getElementById('main').insertAdjacentHTML('beforeend', code);
		let elem = document.querySelector('div.toast_modal:nth-last-of-type(1)');
		elem.dataset['slot'] = (this.openModalsCount+1);
		elem.offsetHeight;
		elem.style['opacity'] = 1;
		this.openModalsCount++;
	},
	
	change: function(id, content = null, red = null, time = null) {
		if(!this.openModals[id]) return;
		if(content) this.openModals[id].elem.children[0].innerHTML = content;
		if(red === true) this.openModals[id].elem.classList.add('red');
		else if(red === false) this.openModals[id].elem.classList.remove('red');
		if(time == 0 && this.openModals[id].timer != null) {clearTimeout(this.openModals[id].timer); this.openModals[id].timer = null;}
		else if(time != null && time > 0) {clearTimeout(this.openModals[id].timer); this.openModals[id].timer = setTimeout(function(){ToastModal.checkClose(id);}, parseInt(time));}
	}
};

/** KEY HANDLER STUFF */
class KeyboardHandler {
	constructor() {
		this._boundHandleKeyDown = this.handleKeyDown.bind(this);
		this._boundHandleKeyUp = this.handleKeyUp.bind(this);
		document.addEventListener('keydown', this._boundHandleKeyDown);
		document.addEventListener('keyup', this._boundHandleKeyUp);
		
		this.init();
	}
	destroy() {
		document.removeEventListener('keydown', this._boundHandleKeyDown);
		document.removeEventListener('keyup', this._boundHandleKeyUp);
	}
	
	init() {
		this._registeredEvents = {};
	}
	
	registerKey(key, func, mods = {}, message = null) {
		if(!this._registeredEvents[key]) this._registeredEvents[key] = [];
		let ev = {callback: func, mods: mods, message: message};
		if(this._registeredEvents[key].indexOf(ev) != -1) return false;
		this._registeredEvents[key].push(ev);
		return true;
	}
	deregisterKey(key, func, mods = {}) {
		if(!this._registeredEvents[key]) return false;
		for(let i = 0; i < this._registeredEvents[key].length; i++) {
			let ev = this._registeredEvents[key][i];
			if(i.func == func && i.mods == mods) {this._registeredEvents[key].splice(i, 1); return true;}
		}
		return false;
	}
	
	deregisterAll() {this._registeredEvents = {};}
	
	handleKeyDown(e) {
		if(e.target.nodeName == 'INPUT' || e.target.nodeName == 'TEXTAREA') return true;
		let evs = this.checkForEvent(e);
		if(evs === false) return;
		e.preventDefault();
		for(let i = 0; i < evs.length; i++) {
			let ev = evs[i];
			try {
				let res = ev.callback(e.code);
				if(ev.message != null && res) {
					if(res === true) ToastModal.open(ev.message.text, false, ev.message.time);
					else ToastModal.open(ev.message.text+': '+res, false, ev.message.time);
				}
			}
			catch(err){console.warn(err);}
		}
	}
	handleKeyUp(e) {
		if(e.target.nodeName == 'INPUT' || e.target.nodeName == 'TEXTAREA') return true;
		if(this.checkForEvent(e) !== false) e.preventDefault();
	}
	
	checkForEvent(e) {
		let key = e.code, shift = e.shiftKey, ctrl = e.ctrlKey, alt = e.altKey;
		if(!this._registeredEvents[key]) return false;
		let res = [];
		for(let i = 0; i < this._registeredEvents[key].length; i++) {
			let ev = this._registeredEvents[key][i];
			if(!ev.mods) ev.mods = {};
			if(!ev.mods.ctrl == ctrl || !ev.mods.shift == shift || !ev.mods.alt == alt) continue;
			res.push({callback: ev.callback, message: ev.message});
		}
		return res.length == 0 ? false : res;
	}
};

var keyHandler = new KeyboardHandler();

function keyboardImport(key) {Modal.confirm("Import Project","<div class='inputFile'><input type='file' class='fileInput' id='fileInput' required /><label for='fileInput'>Click or drop file here</label></div>",loadFile,null,"Load","Cancle","small",false);}
keyHandler.registerKey('KeyI', keyboardImport, {shift: true});
function keyboardNew(key) {Modal.confirm("New Project", "Do you really want to create a new project?<br><br>If data is already loaded it will be erased!", () => {animator.destroy(); return true;}, null, "Create", "Abort", "small", true);}
keyHandler.registerKey('KeyN', keyboardNew, {shift: true});
keyHandler.registerKey('KeyM', () => {document.getElementById('menu').classList.toggle('active');});

function getStorage(key) {
	let storage = localStorage;
	if(!storage) return '';
	return storage.getItem(key);
}
function setStorage(key, value) {
	let storage = localStorage;
	if(value == null || !storage) return false;
	storage.setItem(key, value);
}

function switchDarkMode(e) {
	let target = document.getElementById('main');
	if(this.checked) target.classList.add('dark');
	else target.classList.remove('dark');
	setStorage('darkmode', this.checked ? 1 : 0);
}

function loadFile() {
	let elem = document.getElementById('fileInput');
	if(elem == null) {
		ToastModal.open("Loading error", true);
		console.error("Couldn't find the input element. This shouldn't happen unless something got manipulated.");
		return true;
	}
	
	let file = elem.files[0] || null;
	if(file == null) {
		return true;
	}
	
	let modal = ToastModal.open("<span class='loading'>...</span>", false, 0);
	file.text().then(function(d) {
		data = d;
		let json;
		try{json = JSON.parse(d);} catch(e) {
			ToastModal.change(modal, "Invalid file", true, 5000);
			console.error("Invalid JSON file:", e);
			return;
		}
		parsedData = json;
		
		doLoadFile(json, modal);
	});
	return true;
}

function doLoadFile(json, id = null) {
	let errors = animator.load(json);
	if(errors == 0 && id != null) {
		ToastModal.change(id, "Loading done", false, 5000);
	} else if(errors > 0) {
		if(id != null) ToastModal.change(id, "Errors: "+errors, false, 5000);
		else ToastModal.open("Errors: "+errors);
	}
}

function doExport() {
	let elem = document.getElementById('nameInput');
	if(elem == null) {
		ToastModal.open("Error exporting", true);
		console.error("Couldn't find the input element. This shouldn't happen unless something got manipulated.");
		return true;
	}
	
	let filename = String(elem.value);
	
	let content = animator.print();
	if(content == null) {
		ToastModal.open("Nothing to export");
		return true;
	}
	
	downloadFile = new File([content], filename+".animation", {type: 'text/plain'});
	let downloadURI = URL.createObjectURL(downloadFile);
	let link = document.createElement('a');
	link.href = downloadURI;
	link.download = filename+".animation";
	link.style['display'] = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(downloadURI);
	
	return true;
}

function openHelp() {
	Modal.open(
		"Starbound Animation Editor",
		"A web-based editor to easily create and edit Starbound's .animation files.<br>"+
		"Import an existing .animation file or start from scratch by adding things through the tabs in the center.<br><br>"+
		"<b>Hotkeys:</b><br>"+
		"<span class=\"highlight\">M</span> - Open sidebar menu<br>"+
		"<span class=\"highlight\">Shift + I</span> - Import project<br>"+
		"<span class=\"highlight\">Shift + N</span> - New project"
	);
}

document.addEventListener("DOMContentLoaded", startup);
var animator, ui;
var data = null;
var parsedData = null;
var downloadFile = null;
function startup() {
	animator = new Animator();
	ui = new UI();
	
	if(document.getElementById('main').classList.contains('dark')) document.getElementById('darkmode').checked = true;
	document.getElementById('darkmode').addEventListener('change', switchDarkMode);
	
	document.getElementById('newProjectButton').addEventListener('click', (e) => {
		Modal.confirm("New Project", "Do you really want to create a new project?<br><br>If data is already loaded it will be erased!", () => {animator.destroy(); return true;}, null, "Create", "Abort", "small", true);
	});
	document.getElementById('importButton').addEventListener('click', (e) => {
		Modal.confirm(
			"Import Project",
			"<div class='inputFile'><input type='file' class='fileInput' id='fileInput' required /><label for='fileInput'>Click or drop file here</label></div>",
			loadFile,
			null,
			"Load",
			"Cancle",
			"small",
			false
		);
	});
	document.getElementById('exportButton').addEventListener('click', (e) => {
		if(!animator.hasElements()) {
			ToastModal.open("Nothing to export", true);
			return;
		}
		
		Modal.confirm(
			"Export Project",
			"Enter file name to save as.<br><br><input type='text' class='textfield small' id='nameInput' placeholder='Filename' /><label class='fileext'>.animation</label>",
			doExport,
			null,
			"Save As",
			"Cancle",
			"small",
			false
		);
	});
	document.getElementById('compressionLevel').addEventListener('change', function(e) {
		animator.compressionLevel = this.value;
	});
}