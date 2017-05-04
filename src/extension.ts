'use strict';
import * as vscode from 'vscode';

var wbconfig = vscode.workspace.getConfiguration('workbench');
var nsconfig = vscode.workspace.getConfiguration('nightswitch');

export function activate(context: vscode.ExtensionContext) {

	reload()
	let toggle = makeToggle();
	let switchDay = makeSwitchDay();
	let switchNight = makeSwitchNight();

	var time = new Date()
	var SunCalc = require('suncalc')

	const srisestr = nsconfig.get<string>('sunrise')
	const ssetstr = nsconfig.get<string>('sunset')
	console.log(srisestr)
	console.log(ssetstr)
	
	var srisemanual = -1
	var ssetmanual = -1
	var srisetmrwmanual = -1
	if (srisestr != null) {
		srisemanual = parseManualTime(srisestr,time)
		srisetmrwmanual = srisemanual+24*60*60*1000
	}

	if (ssetstr != null) {
		ssetmanual = parseManualTime(ssetstr,time)
	}

	const manualTimes = [srisemanual,ssetmanual,srisetmrwmanual]
	const forceSwitch = nsconfig.get<boolean>('forceSwitch')


	if (nsconfig.get('location') != null) {
		console.log('NSL: running location');
		const coords = parseCoordinates(nsconfig.get<string>('location'))
		if(Number.isNaN(coords[0]) || Number.isNaN(coords[1]))
		{
			vscode.window.showWarningMessage('Something went wrong with your coordinates. Try using the format \"(xxx.xxxx,yyy.yyyy)\".')
		}
		else{
			console.log('NSL: (' + coords[0] + ',' + coords[1] + ')');
			locationSwitch(coords, time, SunCalc, manualTimes, forceSwitch)
		}
	}
	console.info('NSL: NightSwitch-Lite is now active!');
}


function parseManualTime(date: string, time: Date):number {
    const hm = date.split(':')
    const fullTime = time.getTime()
    const currentHours = time.getHours()		  *60*60*1000
    const currentMinutes = time.getMinutes()			*60*1000
    const currentSeconds = time.getSeconds()			   *1000
    const currentMilliseconds = time.getMilliseconds()

    const todayStart = fullTime-currentHours-currentMinutes-currentSeconds-currentMilliseconds

    const parsedTime = todayStart+(Number(hm[0])*60*60*1000)+(Number(hm[1])*60*1000)

    return parsedTime
}


async function locationSwitch(coords: Number[], time: Date, SunCalc: any, 
					manualTimes: number[], forceSwitch: boolean) {

	var stimes = SunCalc.getTimes(time, coords[0], coords[1]);

	const currtime = time.getTime()

	var srise = manualTimes[0]
	var sset = manualTimes[1]
	var srisetmrw = manualTimes[2]
	
	if (srise=== -1)
	{
		srise = stimes.sunrise.getTime()
		// set a virtual time 12hrs from now to get sunrise tomorrow
		const virtualtime = currtime + 24 * 60 * 60 * 1000;
		var stimestmrw = SunCalc.getTimes(new Date(virtualtime), coords[0], coords[1]);
		srisetmrw = stimestmrw.sunrise.getTime()
	}

	if (sset === -1)
	{
		sset = stimes.sunset.getTime();
	}

	console.log('NSL: current time: ' + currtime)
	console.log('NSL: sunrise: ' + srise)
	console.log('NSL: sunset: ' + sset)
	console.log('NSL: sunrise tomorrow: ' + srisetmrw)

	await timeSwitch(currtime, srise, sset, srisetmrw, forceSwitch)
	reload()
	locationSwitch(coords, new Date(), SunCalc, manualTimes, forceSwitch)
}


async function timeSwitch(currtime: number, srise: number, sset: number, srisetmrw: number, forceSwitch: boolean) {
	const timeToSunrise = srise - currtime,
		timeToSunset = sset - currtime;

	console.log('NSL: timeToSunrise: ' + timeToSunrise)
	console.log('NSL: timeToSunset: ' + timeToSunset)

	if (timeToSunrise > 0) {
		// obviously give priority to sunrise

		if (forceSwitch) {
			setThemeNight()
		}
		console.log('NSL: waiting until sunrise...')
		await sleep(timeToSunrise)
		setThemeDay()
		console.log('NSL: set theme to day')
	}
	else if (timeToSunset > 0) {
		if (forceSwitch) {
			setThemeDay()
		}
		console.log('waiting until sunset...')
		await sleep(timeToSunset)
		setThemeNight()
		console.log('NSL: set theme to night')
	}
	else {
		// this means it's after sunset but before midnight

		if (forceSwitch) {
			setThemeNight()
		}
		console.log('NSL: waiting until sunrise tomorrow...')
		console.log('NSL: sunrise tomorrow: ' + srisetmrw)
		const timeToSunriseTmrw = srisetmrw - currtime
		console.log('NSL: timeToSunriseTmrw: ' + timeToSunriseTmrw)
		await sleep(timeToSunriseTmrw)
		setThemeDay()
	}
}


function makeToggle() {
	return vscode.commands.registerCommand('extension.toggleTheme', () => {
		reload()
		var currentTheme = wbconfig.get<string>('colorTheme'),
			dayTheme = nsconfig.get<string>('dayTheme'),
			nightTheme = nsconfig.get<string>('nightTheme');

		if (currentTheme === dayTheme) {
			setThemeNight()
		}
		else if (currentTheme === nightTheme) {
			setThemeDay()
		}
		else {
			vscode.window.showInformationMessage('Your current theme is not set to either your day or night theme. Please update your settings.');
		}
	});
}


function makeSwitchDay() {
	return vscode.commands.registerCommand('extension.switchDay', () => {
		setThemeDay()
	});
}


function makeSwitchNight() {
	return vscode.commands.registerCommand('extension.switchNight', () => {
		setThemeNight()
	});
}


function parseCoordinates(coords: string): number[] {
	const splcoords = coords.replace(/\(|\)/g,'').split(/,/);
	return new Array(Number(splcoords[0]), Number(splcoords[1]))
}


function setThemeNight() {
	wbconfig.update('colorTheme', nsconfig.get<string>('nightTheme'), true);
}


function setThemeDay() {
	wbconfig.update('colorTheme', nsconfig.get<string>('dayTheme'), true);
}


function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


function reload() {
	// get the current workbench configuration
	wbconfig = vscode.workspace.getConfiguration('workbench');
	// get the user config for nightswitch
	nsconfig = vscode.workspace.getConfiguration('nightswitch');
}


// this method is called when your extension is deactivated
export function deactivate() {
}