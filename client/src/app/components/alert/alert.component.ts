import {Component, OnInit, Output} from '@angular/core';
import {AlertService} from '../../services/alert.service';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';

@Component({
	selector: 'app-alert',
	styleUrls: ['./alert.component.scss'],
	templateUrl: 'alert.component.html'
})

export class AlertComponent {
	@Output() public message$: BehaviorSubject<any> = new BehaviorSubject(null);

	private _timer;
	private _timeout = 7000;

	constructor(private alertService: AlertService) { }

	ngOnInit() {
		this.alertService.getMessage().subscribe(message => { {

			clearTimeout(this._timer);

			this.message$.next(message);

			this._timer = setTimeout(() => this.message$.next(null), this._timeout);
		} });
	}
}