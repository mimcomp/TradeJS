import * as path        from 'path';
import * as mkdirp      from 'mkdirp';
import * as winston     from 'winston-color';

import Mapper           from './CacheMap';
import Fetcher          from './CacheFetch';
import WorkerChild      from '../worker/WorkerChild';
import BrokerApi        from '../broker-api/oanda/oanda';
import BarCalculator    from './util/bar-calculator';
import CacheDataLayer   from './CacheDataLayer';

// const sqlLite     = require('sqlite3').verbose();

export default class Cache extends WorkerChild {

	public settings: { account: AccountSettings, path: any } = this.opt.settings;

	private _ready = false;
	private _brokerApi: BrokerApi = null;

	private _dataLayer: CacheDataLayer;
	private _mapper: Mapper;
	private _fetcher: Fetcher;
	private _barCalculator: BarCalculator = new BarCalculator();
	private _instrumentList: Array<any> = [];

	private _listeners = {};

	public async init() {
		await super.init();

		// Ensure cache dir exists
		mkdirp.sync(this.settings.path.cache);

		this._dataLayer = new CacheDataLayer({
			path: path.join(this.settings.path.cache, 'database.db')
		});

		this._mapper = new Mapper({path: this.settings.path.cache});
		this._fetcher = new Fetcher({dataLayer: this._dataLayer, mapper: this._mapper, brokerApi: this._brokerApi});

		await this._dataLayer.init();
		await this._mapper.init();
		await this._fetcher.init();

		await this._setChannelEvents();
		await this._ipc.startServer();
	}

	public async read(instrument: string, timeFrame: string, from?: number, until?: number, count?: number, bufferOnly = true): Promise<any> {

		if (count && from && until)
			return Promise.reject('Cache->Read : Only from OR until can be given when using count, not both');

		if (!from && !until) {
			until = Date.now();
		}

		count = count || 500;

		let data = await this._dataLayer.read(instrument, timeFrame, from, until, count);

		if (!data.length || data.length / 10 < count /*|| !this._mapper.isComplete(instrument, timeFrame, data[0], data[data.length - 10])*/) {

			await this._fetcher.fetch(this._brokerApi, instrument, timeFrame, from, until, count);

			data = await this._dataLayer.read(instrument, timeFrame, from, until, count);
		}

		return data;
	}

	public async reset(instrument?: string, timeFrame?: string, from?: number, until?: number) {
		winston.info('Reset cache');

		await Promise.all([
			this._mapper.reset(instrument, timeFrame),
			this._dataLayer.reset()
		]);

		return this._dataLayer.createInstrumentTables(this._instrumentList.map(instr => instr.instrument));
	}

	public async fetch(instrument, timeFrame, from, until, count) {

	}

	private _broadCastTick(tick) {
		this._ipc.send('main', 'tick', tick, false);
	}

	private _setChannelEvents() {
		this._ipc.on('read', (opt, cb) => {
			this
				.read(opt.instrument, opt.timeFrame, opt.from, opt.until, opt.count, opt.bufferOnly)
				.then(data => cb(null, data))
				.catch(cb);
		});

		this._ipc.on('fetch', (opt, cb) => {
			this
				._fetcher
				.fetch(this._brokerApi, opt.instrument, opt.timeFrame, opt.from, opt.until, opt.count)
				.then(() => cb(null))
				.catch(cb);
		});

		this._ipc.on('@reset', (opt, cb) => {
			this
				.reset()
				.then(data => cb(null, data))
				.catch(cb);
		});

		this._ipc.on('register', (opt, cb) => {
			this._listeners[opt.id] = opt.instrument;
			cb(null);
		});

		this._ipc.on('unregister', (opt, cb) => {
			delete this._listeners[opt.id];
			cb(null);
		});

		this._ipc.on('instruments-list', (opt, cb) => {
			cb(null, this._instrumentList);
		});

		this._ipc.on('broker:settings', async (accountSettings: AccountSettings, cb) => {
			this.settings.account = accountSettings;
			cb(null, await this._setBrokerApi())
		});
	}

	private async _setBrokerApi(): Promise<boolean> {
		this._ready = false;

		try {
			if (this._brokerApi)
				await this._brokerApi.destroy();

			this._brokerApi = new BrokerApi(this.settings.account);
			await this._brokerApi.init();

			this._brokerApi.on('error', error => {});
			this._brokerApi.on('tick', tick => this._broadCastTick(tick));

			if (await this._loadAvailableInstruments() === true && await this._openTickStream() === true) {
				this._ready = true;
			}
		} catch (error) {
			console.error(error);
		}

		return this._ready;
	}

	private async _loadAvailableInstruments(): Promise<boolean> {
		winston.info('loading instruments list');

		try {
			let instrumentList = await this._brokerApi.getInstruments();
			let currentPrices = await this._brokerApi.getCurrentPrices(instrumentList.map(instrument => instrument.instrument));

			instrumentList.forEach(instrument => {
				let price = currentPrices.find(priceObj => priceObj.instrument === instrument.instrument);

				instrument.bid = price.bid;
				instrument.ask = price.ask;
			});

			await this._dataLayer.createInstrumentTables(instrumentList.map(instr => instr.instrument));

			// Do not trust result
			this._instrumentList = instrumentList;

			return true;
		} catch (error) {
			console.log(error);
			return false;
		}
	}

	private async _openTickStream(): Promise<any> {
		winston.info('opening tick stream');

		try {
			await Promise.all(this._instrumentList.map(instrument => this._brokerApi.subscribePriceStream(instrument.instrument)));
			return true;
		} catch (error) {
			return false;
		}
	}
}