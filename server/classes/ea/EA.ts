import Instrument from '../instrument/Instrument';
import OrderManager from '../../modules/order/OrderManager';
import AccountManager from '../../modules/account/AccountManager';
import * as Stream from 'stream';

export interface IEA {
	orderManager: OrderManager;
	onTick(timestamp, bid, ask): Promise<any>|void;
}

export default class EA extends Instrument implements IEA {

	public tickCount = 0;
	public live = false;

	public accountManager: AccountManager;
	public orderManager: OrderManager;

	private _backtestData = {
		totalFetchTime: 0,
		startTime: null,
		endTime: null
	};

	constructor(...args) {
		super(args[0], args[1]);
	}

	public async init() {
		await super.init();

		this.accountManager = new AccountManager({
			equality: this.options.equality
		});

		this.orderManager = new OrderManager(this.accountManager, {
			live: this.options.live,
			ipc: this._ipc
		});

		await this.accountManager.init();
		await this.orderManager.init();

		this._ipc.on('@run', opt => this.runBackTest());
		this._ipc.on('@report', (data, cb) => cb(null, this.report()));

		await this.onInit();
	}

	public report() {
		return {
			tickCount: this.tickCount,
			equality: this.accountManager.equality + this.orderManager.getOpenOrdersValue(this.bid, this.ask),
			orders: this.orderManager.closedOrders,
			data: this._backtestData
		};
	}

	async tick(timestamp, bid, ask): Promise<void> {
		await super.tick(timestamp, bid, ask);

		if (this.options.live === false) {
			this.orderManager.tick()
		}

		await this.onTick(timestamp, bid, ask);
	}

	public onTick(timestamp, bid, ask) {
		console.log('CUSTOM ONTICK SHOULD BE CALLED')
	}

	public async onInit() {
	}

	protected async addOrder(orderOptions) {
		let result = this.orderManager.add(Object.assign(orderOptions, {openTime: this.time}));

		return result;
	}

	protected closeOrder(id, bid, ask) {
		this.orderManager.close(this.time, id, bid, ask)
	}

	protected closeAllOrders(id, bid, ask) {
		this.orderManager.close(this.time, id, bid, ask)
	}

	async runBackTest(): Promise<any> {
		let count = 1000,
			candles, lastTime, lastBatch = false,
			from = this.options.from,
			until = this.options.until;

		let p = this._ipc.send('cache', 'read', {
			instrument: this.instrument,
			timeFrame: this.timeFrame,
			from: from,
			count: count
		}).then(_candles => {this._backtestData.startTime = Date.now(); return _candles; });

		while (true) {
			candles = await p;

			// There is no more data, so stop
			if (!candles.length)
				break;

			from = candles.readDoubleLE(candles.length - (10 * Float64Array.BYTES_PER_ELEMENT)) + 1;

			if (from < until) {
				p = this._ipc.send('cache', 'read', {
					instrument: this.instrument,
					timeFrame: this.timeFrame,
					from: from,
					count: count
				});
			}

			let ticks = new Float64Array(Buffer.from(candles).buffer);

			// See if until is reached in this batch
			if (from > until) {

				// Loop to find index of last candle
				for (let i = 0, len = ticks.length; i < len; i += 10) {
					if (ticks[i] >= until) {
						ticks = ticks.slice(0, i);
						lastBatch = true;
						break;
					}
				}
			}

			await this.inject(ticks);

			// There are no more candles to end
			if (lastBatch || ticks.length < count)
				break;
		}

		this._backtestData.endTime = Date.now();

		this.orderManager.closeAll(lastTime, this.bid, this.ask);

		this._ipc.send('main', '@run:end', undefined, false);
	}
}