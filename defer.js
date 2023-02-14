// Switch theme early based on settings
let storedDarkMode = getStorage('darkmode')
let isDarkmode = storedDarkMode == 1 || (storedDarkMode == "" && window.matchMedia && window.matchMedia('(prefer-color-scheme: dark)').matches);
let elem;
if(isDarkmode) {
	let elem = document.getElementById('main')
	elem.style['transition'] = 'none';
	elem.classList.add('dark');
	elem.offsetHeight;
	elem.style['transition'] = null;
	
	elem = document.getElementById('menu_icon');
	elem.style['transition'] = 'none';
	elem.offsetHeight;
	elem.style['transition'] = null;
	document.getElementById('darkmode').checked = true;
}

elem = document.querySelector('.tab_header.active');
elem.style['transition'] = 'none';
elem.offsetHeight;
elem.style['transition'] = null;