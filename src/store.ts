export { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { BrowserQRCodeReader } from '@zxing/browser';
import { toDataURL } from 'qrcode';

class Store {
	qreader = new BrowserQRCodeReader(new Map().set(2, [11]), { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 100 })
	qrindex = 0
	qrcode = ['']
	qrdata = ['']
	qrsrc = ''
	input = ''
	video: any
	shareAnchor: any
	scanner = false
	scanmode = 'environment'

	constructor() {
		makeAutoObservable(this);
	}
	set = (o: any) => {
		runInAction(() => Object.keys(o).forEach((k) => this[k] = o[k]))
	}
	init = (o = {}) => {
		this.set({ qrindex: 0, qrcode: [''], qrdata: [''], qrsrc: '', input: '', ...o })
	}
	scan = (video: HTMLVideoElement, facingMode: string) => {
		navigator.mediaDevices.getUserMedia({ video: { facingMode, width: 600, height: 600 } }).then((m) => {
			video.srcObject = m, video.play()
			this.qreader.decodeFromVideoElement(video, (i: any) => i && (this.setInput(i.getText()), this.toggleScan()))
		}).catch(() => runInAction(() => (this.input = 'Scanning device could not be found!', this.toggleScan())))
	}
	scaninit = ({ video }: { video: HTMLVideoElement }) => {
		this.init({ scanner: true, video })
		this.scan(video, this.scanmode)
		return () => this.video.srcObject?.getTracks()?.[0]?.stop()
	}
	setInput = (i: string) => {
		this.set({ input: i, qrindex: 0 })
		if (i !== '') {
			const qrdata = i.match(/[^]{2048}|[^]+/g)!
			const qrcode = qrdata.map((v) => toDataURL(v, { margin: 1, scale: 16 }))
			Promise.all(qrcode).then((qrcode) => this.set({ qrcode, qrdata, qrsrc: qrcode[0] }))
		} else this.qrsrc = ''
	}
	setIndex = (i: number) => {
		this.set({ qrindex: i, qrsrc: this.qrcode[i], input: this.qrdata[i] })
	}
	toggleScan = () => {
		window.location.hash = ((this.scanner = !this.scanner)) ? '/scan' : '/'
	}
	switchScan = () => {
		this.video.srcObject.getTracks()[0].stop()
		this.scan(this.video, this.scanmode = this.scanmode === 'environment' ? 'user' : 'environment')
	}
	toggleShare = (anchor = null) => {
		this.set({ shareAnchor: this.shareAnchor ? null : anchor })
	}
	copy = () => {
		navigator.clipboard.writeText(this.input)
	}
	paste = () => {
		navigator.clipboard.readText().then(this.setInput)
	}
	upload = (files: FileList | never[]) => {
		if (this.scanner) this.toggleScan()
		this.init()
		for (const file of files) {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = async (e: ProgressEvent) => {
				let img: any = document.createElement("img")
				img.src = (e.target as FileReader).result as string
				const decode = await this.qreader.decodeFromImageElement(img).then((d) => d.getText()).catch(() => 'invalid')
				runInAction(() => {
					if (this.qrcode[0]) this.qrdata.push(decode), this.qrcode.push(img.src)
					else this.qrdata = [decode], this.qrcode = [img.src]
					img = null, this.qrsrc = this.qrcode[0], this.input = this.qrdata[0]
				})
			}
		}
	}
	download = () => {
		if (!this.qrsrc) return
		const a = document.createElement("a")
		a.download = 'qrcode.png', a.href = this.qrsrc
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
	share = (type: string) => {
		this.set({ shareAnchor: null })
		const O: any = {}
		switch (type) {
			case 'text':
				if (!this.input) return
				return navigator.share({ text: this.input })
			case 'file':
				if (!this.qrsrc) return
				[O.mime, O.data] = this.qrsrc.split(",")
				O.bstr = Buffer.from(O.data, 'base64').toString('latin1')
				return navigator.share({ files: [new File([new Uint8Array(O.bstr.length).map((_, i) => O.bstr.charCodeAt(i))], 'qrcode.png', { type: O.mime.match(/:(.*?);/)?.[1] })] })
			case 'files':
				if (!this.qrsrc) return
				O.files = this.qrcode.map((code, index) => {
					const [mime, data] = code.split(",")
					const bstr = Buffer.from(data, 'base64').toString('latin1')
					return new File([new Uint8Array(bstr.length).map((_, i) => bstr.charCodeAt(i))], `qrcode${index}.png`, { type: mime.match(/:(.*?);/)?.[1] })
				})
				return navigator.share({ files: O.files })
			default:
				return
		}
	}
}

export default new Store();