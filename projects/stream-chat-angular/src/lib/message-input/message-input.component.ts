import {
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  Type,
  ViewChild,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { AttachmentService } from '../attachment.service';
import { ChannelService } from '../channel.service';
import { textareaInjectionToken } from '../injection-tokens';
import { NotificationService } from '../notification.service';
import { AttachmentUpload, StreamMessage } from '../types';
import { MessageInputConfigService } from './message-input-config.service';
import { TextareaDirective } from './textarea.directive';
import { TextareaInterface } from './textarea.interface';

@Component({
  selector: 'stream-message-input',
  templateUrl: './message-input.component.html',
  styles: [],
  providers: [AttachmentService],
})
export class MessageInputComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isFileUploadEnabled: boolean | undefined;
  @Input() acceptedFileTypes: string[] | undefined;
  @Input() isMultipleFileUploadEnabled: boolean | undefined;
  @Input() message: StreamMessage | undefined;
  @Output() readonly messageUpdate = new EventEmitter<void>();
  isFileUploadAuthorized: boolean | undefined;
  attachmentUploads$: Observable<AttachmentUpload[]>;
  textareaValue = '';
  textareaRef: ComponentRef<TextareaInterface> | undefined;
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(TextareaDirective, { static: true })
  private textareaAnchor!: TextareaDirective;
  private subscriptions: Subscription[] = [];
  private hideNotification: Function | undefined;

  constructor(
    private channelService: ChannelService,
    private notificationService: NotificationService,
    private attachmentService: AttachmentService,
    private configService: MessageInputConfigService,
    @Inject(textareaInjectionToken)
    private textareaType: Type<TextareaInterface>,
    private componentFactoryResolver: ComponentFactoryResolver
  ) {
    this.subscriptions.push(
      this.channelService.activeChannel$.subscribe((channel) => {
        this.textareaValue = '';
        this.attachmentService.resetAttachmentUploads();
        const capabilities = channel?.data?.own_capabilities as string[];
        if (capabilities) {
          this.isFileUploadAuthorized =
            capabilities.indexOf('upload-file') !== -1;
        }
      })
    );
    this.subscriptions.push(
      this.attachmentService.attachmentUploadInProgressCounter$.subscribe(
        (counter) => {
          if (counter === 0 && this.hideNotification) {
            this.hideNotification();
            this.hideNotification = undefined;
          }
        }
      )
    );
    this.attachmentUploads$ = this.attachmentService.attachmentUploads$;
    this.isFileUploadEnabled = this.configService.isFileUploadEnabled;
    this.acceptedFileTypes = this.configService.acceptedFileTypes;
    this.isMultipleFileUploadEnabled =
      this.configService.isMultipleFileUploadEnabled;
  }

  ngOnInit(): void {
    const componentFactory =
      this.componentFactoryResolver.resolveComponentFactory(this.textareaType);
    this.textareaRef =
      this.textareaAnchor.viewContainerRef.createComponent<any>(
        componentFactory
      );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.message) {
      this.attachmentService.resetAttachmentUploads();
      if (this.isUpdate) {
        this.attachmentService.createFromAttachments(
          this.message!.attachments || []
        );
        this.textareaValue = this.message!.text || '';
      }
    }
    if (changes.isFileUploadEnabled) {
      this.configService.isFileUploadEnabled = this.isFileUploadEnabled;
    }
    if (changes.acceptedFileTypes) {
      this.configService.acceptedFileTypes = this.acceptedFileTypes;
    }
    if (changes.isMultipleFileUploadEnabled) {
      this.configService.isMultipleFileUploadEnabled =
        this.isMultipleFileUploadEnabled;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  async messageSent() {
    let attachmentUploadInProgressCounter!: number;
    this.attachmentService.attachmentUploadInProgressCounter$
      .pipe(first())
      .subscribe((counter) => (attachmentUploadInProgressCounter = counter));
    if (attachmentUploadInProgressCounter > 0) {
      if (!this.hideNotification) {
        this.hideNotification =
          this.notificationService.addPermanentNotification(
            'streamChat.Wait until all attachments have uploaded'
          );
      }
      return;
    }
    const attachments = this.attachmentService.mapToAttachments();
    const text = this.textareaValue;
    if (!text && (!attachments || attachments.length === 0)) {
      return;
    }
    if (!this.isUpdate) {
      this.textareaValue = '';
    }
    try {
      await (this.isUpdate
        ? this.channelService.updateMessage({
            ...this.message!,
            text: text,
            attachments: attachments,
          })
        : this.channelService.sendMessage(text, attachments));
      this.messageUpdate.emit();
      if (!this.isUpdate) {
        this.attachmentService.resetAttachmentUploads();
      }
    } catch (error) {
      if (this.isUpdate) {
        this.notificationService.addTemporaryNotification(
          'streamChat.Edit message request failed'
        );
      }
    }
  }

  get accept() {
    return this.acceptedFileTypes ? this.acceptedFileTypes?.join(',') : '';
  }

  async filesSelected(fileList: FileList | null) {
    await this.attachmentService.filesSelected(fileList);
    this.clearFileInput();
  }

  private clearFileInput() {
    this.fileInput.nativeElement.value = '';
  }

  private get isUpdate() {
    return !!this.message;
  }
}
