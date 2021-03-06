import {
	ChangeDetectionStrategy, Component, ElementRef, Host, Input, NgZone, OnInit, Output, Pipe, PipeTransform,
	ViewEncapsulation
} from '@angular/core';
import {UserService} from '../../services/user.service';
import {Http} from '@angular/http';
import {FormBuilder} from '@angular/forms';
import {ActivatedRoute} from "@angular/router";
import {CommentService} from "../../services/comment.service";
import {Subject} from "rxjs/Subject";
import {CommentModel} from "../../models/comment.model";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {ProfileComponent} from "../profile/profile.component";

function linkify(inputText) {
	var replacedText, replacePattern1, replacePattern2, replacePattern3;

	//URLs starting with http://, https://, or ftp://
	replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
	replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank" class="g-link">$1</a>');

	//URLs starting with "www." (without // before it, or it'd re-link the ones done above).
	replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
	replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank" class="g-link">$2</a>');

	//Change email addresses to mailto:: links.
	replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
	replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1" class="g-link">$1</a>');

	return replacedText;
}

@Pipe({name: 'parseCommentContent'})
export class ParseCommentContentPipe implements PipeTransform {
	transform(value: string, field: string): string {
		return linkify(value);
	}
}


@Component({
	selector: 'app-social-feed',
	styleUrls: ['./social.feed.component.scss'],
	templateUrl: 'social.feed.component.html',
	encapsulation: ViewEncapsulation.Native,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocialFeedComponent implements OnInit {

	@Input() model;
	@Output() comments$: BehaviorSubject<Array<CommentModel>> = new BehaviorSubject([]);


	channelId: string;

	constructor(private _route: ActivatedRoute,
				@Host() public parent: ProfileComponent,
				public commentService: CommentService,
				public userService: UserService) {
	}

	async ngOnInit() {
		this.parent.user$.subscribe(async (user) => {
			this.channelId = user.options._id;

			this.comments$.next(await this.commentService.findByChannelId(this.channelId));
		});
	}

	onEnterFunction() {

	}

	focusInput(event) {
		event.currentTarget.parentNode.parentNode.querySelector('input').focus();
	}

	async respond(event, parentModel) {
		console.log(event, parentModel);

		const input = event.currentTarget.querySelector('input');
		input.setAttribute('disabled', true);
		const comment = await this.commentService.create(this.channelId, this.channelId, parentModel, input.value);
		input.removeAttribute('disabled');
		if (!comment)
			return;

		input.value = '';

		this.addMessage(comment);
		// this.newMessage.emit(comment);
	}

	addMessage(model) {
		const current = Array.from(this.comments$.getValue());

		if (model.options.parentId)
			current.find(c => c.options._id === model.options.parentId).options.children.push(model);
		else
			current.unshift(model);

		this.comments$.next(current);

	}

	onChangeFileInput(event) {

	}
}