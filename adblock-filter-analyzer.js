// Copyright https://www.RedDragonWebDesign.com/
// Permission required to use or copy code. All rights reserved.

"use strict";

class AdBlockSyntaxBlock {
	string = "";
	json = "";
	richText = "";
	countTrue = 0;
	countFalse = 0
	countNotSure = 0;
	countComments = 0;
	countMismatches = 0;
	
	parseString(s) {
		this.parse(s);
	}
	
	parseRichText(richText) {
		let s = richText;
		// remove spans
		s = s.replace(/<span class=\".*?\">/g, "");
		s = s.replace(/<\/span>/g, "");
		// convert <br /> to \n
		s = s.replace(/<br>/g, "\n");
		this.parse(s);
	}
	
	parse(s) {
		this.string = s;
		let lines = s.split("\n");
		for ( let lineString of lines) {
			if ( lineString !== '' ) {
				let line = new AdBlockSyntaxLine(lineString);
				this.json += line.getJSON() + "\n\n";
				this.richText += line.getRichText();
			
				// increment the true/false counters
				this.incrementCounters(line);
			}
			this.richText += "<br />";
		}
		
		this.json = this.countTrue + " valid, "
			+ this.countNotSure + " unsure, "
			+ this.countFalse + " invalid, "
			+ this.countComments + " comments, "
			+ this.countMismatches + " mismatches"
			+ "\n\n"
			+ this.json;
	}
	
	incrementCounters(line) {
		if ( line.syntax['comment'] ) {
			this.countComments++;
		} else {
			switch( line.isValid ) {
				case true:
					this.countTrue++;
					break;
				case false:
					this.countFalse++;
					break;
				case "not sure":
					this.countNotSure++;
					break;
				case "mismatch":
					this.countMismatches++;
					break;
			}
		}
	}
}

class AdBlockSyntaxLine {
	string = "";
	toParse = "";
	// TODO: refactor this to have sub arrays, such as "code", "isValid", "tooltipText", etc.
	syntax = {
		'uboPreParsingDirective': '', // !#
		'agHint': '', // !+
		'comment': '', // !
		'exception': '', // @@
		'exceptionRegEx': '', // @@/regex/
		'domainRegEx': '', // /regex/
		'domain': '',
		'option': '', // $
		'selectorException': '', // #@#
		'selector': '', // ##
		'htmlFilter': '', // ##^
		'htmlFilterException': '', // #@#^
		'abpExtendedSelector': '', // #?#
		'actionOperator': '', // :style() :remove()
		'uboScriptlet': '', // ##+js()
		'uboScriptletException': '', // #@#+js()
		'abpSnippet': '', // #$#
	};
	isValid = "not sure";
	errorHint = "";
	
	constructor(s) {
		this.string = s;
		this.toParse = this.string;
		
		try {
			this.categorizeSyntax();
			this.splitCommas();
			this.validateEachCategory();
			// TODO: this.genericOrSpecific(); // https://help.eyeo.com/en/adblockplus/how-to-write-filters#generic-specific
		} catch(e) {
			// only catch what we want, let actual errors throw to console
			if ( e === true || e === false || e === "not sure" ) {
				this.isValid = e;
			} else {
				throw e;
			}
		}
		
		if ( this.isValid !== true ) {
			try {
				this.lookForErrors();
			} catch(e) {
				// only catch what we want, let actual errors throw to console
				if ( e === true || e === false || e === "not sure" ) {
					this.isValid = e;
				} else {
					throw e;
				}
			}
		}
		this.lookForMismatch();
	}
	
	lookForErrors() {
		let s = this.string;
		
		// Delete regex. Regex is allowed to contain our special chars. When we do our searches, we don't want to get false positives.
		s = s.replace(/^\/.*?[^\\]\//g, '');
		s = s.replace(/^@@\/.*?[^\\]\//g, '@@');
		
		// TODO: css can have $ sign
		
		
		
		// look for double selectors
		let count = Helper.countRegExMatches(s, /\$|#@#|##|##\^|#@#\^|#\?#|##\+js\(|#@#\+js\(|#\$#/);
		if ( count > 1 ) {
			this.errorHint = "selector type syntax $ #@# ## ##^ #@#^ #?# ##+js( #@#+js( #$# is only allowed once per filter";
			throw false;
		}
		
		// look for double actionOperators
		
		
		
		// actionOperators only allowed in specific cases
		
		
		
		
		
		
		// @@exceptions may not contain any selectors except options
		// actionOperator can only be used with ## #?# and maybe some others
		// only one selector per filter
		// only one action operator per filter
		
		/*
		! can't have things twice
		example.com##test#?#test:style(position: absolute !important;)
		example.com#?#test##test:style(position: absolute !important;)
		example.com##test:style(position: absolute !important;):style(position: absolute !important;)
		example.com#?#test:style(position: absolute !important;):style(position: absolute !important;)
		example.com##test#@#test
		example.com##test#?#test
		example.com#?#test##test
		
		! action operators :style() and :remove() are not allowed to be applied in many cases
		example.com##^.badstuff:style(position: absolute !important;)
		example.com##^.badstuff:remove(position: absolute !important;)
		example.com#@#^.badstuff:style(position: absolute !important;)
		example.com#@#^.badstuff:remove(position: absolute !important;)
		example.com#@#.badstuff:style(position: absolute !important;)
		example.com#@#.badstuff:remove(position: absolute !important;)
		tribunnews.com##+js(acis, Math, ='\x):style(position: absolute !important;)
		test.com$websocket:style(position: absolute !important;)
		audiofanzine.com#$#abort-on-property-read TextDecoder:style(position: absolute !important;)
		*/
		
	}
	
	lookForMismatch() {
		let lineString = "";
		for ( let key in this.syntax ) {
			lineString += this.syntax[key];
		}
		
		if ( lineString !== this.string ) {
			this.isValid = "mismatch";
		}
	}
	
	/** dice syntax string up into categories: comment !, exception @@, domain, option $, selectorException #@#, selector ##, abpExtendedSelector #?#, actionoperator :style(), abpSnippet #$#, etc. */
	categorizeSyntax() {
		this.lookForComments();
		this.lookForDomains();
		this.lookForSelectors();
		this.lookForActionOperators();
	}
		
	lookForComments() {	
		// uboPreParsingDirective !#
		if ( this.toParse.left(2) === "!#" ) {
			this.syntax['uboPreParsingDirective'] = this.string;
			throw "not sure";
		}
		
		// agHint !+
		if ( this.toParse.left(2) === "!+" ) {
			this.syntax['agHint'] = this.string;
			throw "not sure";
		}
		
		// comment !
		if ( this.string.left(1) === '!' ) {
			this.syntax['comment'] = this.string;
			throw true;
		}
	}
	
	lookForDomains() {
		// exception @@
		let domainException = false;
		if ( this.string.left(2) === '@@' ) {
			domainException = true;
			if ( this.toParse.search(/#@#|##|#\?#|:style\(|:remove\(|#\$#/) !== -1 ) {
				this.errorHint = "@@ statements may not contain #@# ## #?# :style() :remove() #$#"
				throw false;
			}
		}
		
		// domain
		// parse until $ #@# ## #?# #$#
		// str.search returns first position, when searching from left to right (good)
		let matchPos = this.toParse.search(/#@#|##|#\?#|#\$#|\$/);
		// if no categories after the domain
		if ( matchPos === -1 ) {
			this.syntax['domain'] = this.toParse;
			this.toParse = '';
		} else {
			this.syntax['domain'] = this.toParse.left(matchPos);
			this.toParse = this.toParse.slice(matchPos);
		}
		
		// no spaces allowed in domain name
		if ( this.syntax['domain'] && this.syntax['domain'].search(/ /) !== -1 ) {
			this.errorHint = "no spaces allowed in domain name";
			throw false;
		}
		
		// exception @@ must have a domain
		if ( domainException && ! this.syntax['domain'] ) {
			this.errorHint = "exception @@ must have a domain";
			throw false;
		}
		
		// exception @@
		if ( domainException ) {
			this.syntax['exception'] = this.syntax['domain'];
			this.syntax['domain'] = "";
		}
		
		// regex special case: /blahblah$/
		// need to handle this carefully because of the $ sign, also used to indicate option
		if ( this.toParse.left(2) === "$/" ) {
			this.syntax['domain'] += "$/";
			this.toParse = this.toParse.slice(2);
		}
		
		// domainRegEx /domain/
		if (
			this.syntax['domain'] &&
			this.syntax['domain'].left(1) === "/" &&
			this.syntax['domain'].right(1) === "/"
		) {
			this.syntax['domainRegEx'] = this.syntax['domain'];
			this.syntax['domain'] = "";
		}
		
		// exceptionRegEx @@/domain/
		if (
			this.syntax['exception'] &&
			this.syntax['exception'].left(3) === "@@/" &&
			this.syntax['exception'].right(1) === "/"
		) {
			this.syntax['exceptionRegEx'] = this.syntax['exception'];
			this.syntax['exception'] = "";
		}
	}
	
	lookForSelectors() {
		// option $ (example: image)
		if ( this.toParse.left(1) === '$' ) {
			this.syntax['option'] = this.toParse;
			// OK to have nothing before it
			// Nothing allowed after it
			throw "not sure";
		}
		
		// abpSnippet #$# (example: log hello world!)
		if ( this.toParse.left(3) === "#$#" ) {
			this.syntax['abpSnippet'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		// uboScriptletException #@#+js(
		if ( this.toParse.left(7) === "#@#+js(" ) {
			this.syntax['uboScriptletException'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		// uboScriptlet ##+js(
		if ( this.toParse.left(6) === "##+js(" ) {
			this.syntax['uboScriptlet'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		// htmlFilter ##^
		if ( this.toParse.left(3) === "##^" ) {
			this.syntax['htmlFilter'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		// htmlFilterException #@#^
		if ( this.toParse.left(4) === "#@#^" ) {
			this.syntax['htmlFilterException'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		// selectorException #@#
		if ( this.toParse.left(3) === "#@#" ) {
			this.syntax['selectorException'] = this.toParse;
			// Nothing allowed after it
			throw "not sure";
		}
		
		let matchPos;
		// selector ##
		if ( this.toParse.left(2) === "##" ) {
			// parse until :style() or :remove() encountered
			matchPos = this.toParse.search(/:style\(|:remove\(/);
			
			// if no action operators
			if ( matchPos === -1 ) {
				this.syntax['selector'] = this.toParse;
				throw "not sure";
			} else {
				this.syntax['selector'] = this.toParse.left(matchPos);
				this.toParse = this.toParse.slice(matchPos);
				this.syntax['actionOperator'] = this.toParse;
				
				let matches = Helper.countRegExMatches(this.toParse, /:style\(|:remove\(/);
				if ( matches > 1 ) {
					this.errorHint = "Can't have action operators :style() :remove() more than once.";
					throw false;
				}
			}
		}
		
		// abpExtendedSelector #?#
		if ( this.toParse.left(3) === "#?#" ) {
			// parse until :style() or :remove() encountered
			matchPos = this.toParse.search(/:style\(|:remove\(/);
			
			// if no action operators
			if ( matchPos === -1 ) {
				this.syntax['abpExtendedSelector'] = this.toParse;
				throw "not sure";
			} else {
				this.syntax['abpExtendedSelector'] = this.toParse.left(matchPos);
				this.toParse = this.toParse.slice(matchPos);
				this.syntax['actionOperator'] = this.toParse;
				
				let matches = Helper.countRegExMatches(this.toParse, /:style\(|:remove\(/);
				if ( matches > 1 ) {
					this.errorHint = "Can't have action operators :style() :remove() more than once.";
					throw false;
				}
			}
		}
	}
	
	lookForActionOperators() {
		
	}
	
	/** split commas */
	splitCommas() {
		// domain - split by commas
		// option - split by commas
		// selector - split by commas
		// abpExtendedSelector - split by commas
		// selectorException - split by commas
		// abpSnippet - split by )+js( for top level, commas for second level
		// actionoperator - split by SEMICOLONS
	}
	
	/** now, do validation on each individual category */
	validateEachCategory() {
		// note: selector syntax is definitely case sensitive. URL's might be too
		
		// domain regex probably has to be all or nothing. can't mix in te/s/t because / can also be part of the URL
		
		// make sure that "cosmetic filters" in CSS selectors doesn't make filter invalid.
		// Examples of "cosmetic filters":
		// :has(...), :has-text(...), :if(...), :if-not(...), :matches-css(...), :matches-css-before(...), :matches-css-after(...), :min-text-length(n), :not(...), :nth-ancestor(n), :upward(arg), :watch-attr(...), :xpath(...)
		
		// uboScriptlet ##+js(
		// must have domain, except for certain exceptions: #@#+js()
		// are multiple allowed? Not sure. uBlock validator says yes. I can't find any double examples in filter lists though
	}
	
	getJSON() {
		let s = "";
		s += "Filter = " + this.string + "\n";
		s += "Valid? = " + this.isValid + "\n";
		if ( this.errorHint ) {
			s += "Error Hint = " + this.errorHint + "\n";
		}
		s += JSON.stringify(this.syntax);
		// add enters after commas
		s = s.replace(/",/g, '",\n');
		return s;
	}
	
	getRichText() {
		let richText = "";
		let classes = "";
		for ( let key in this.syntax ) {
			classes = key;
			if ( ! this.isValid || this.isValid === "mismatch" ) {
				classes += " error";
			}
			if ( this.syntax[key] ) {
				richText += '<span class="' + classes + '">' + this.syntax[key] + '</span>';
			}
		}
		return richText;
	}
}

Object.assign(String.prototype, {
	/** @description "Testing 123".left(4) = "test" */
	left(length) {
		return this.slice(0, length);
	},
	
	/** @description "Testing 123".right(3) = "123" */
	right(length) {
		return this.substr(this.length - length);
	}
});

class Helper {
	static countRegExMatches(str, regExPattern) {
		regExPattern = new RegExp(regExPattern, "g");
		return ((str || '').match(regExPattern) || []).length;
	}

	static escapeHTML(unsafe) {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
	
	static unescapeHTML(input) {
		return input
			.replace("&amp;", /&/g)
			.replace("&lt;", /</g)
			.replace("&gt;", />/g)
			.replace("&quot;", /"/g)
			.replace("&#039;", /'/g);
	}

	static getStartOffset() {
		var selection = window.getSelection();
		if ( selection.getRangeAt && selection.rangeCount ) {
			let range = selection.getRangeAt(0).cloneRange();
			let startOffset = range.startOffset;
			return startOffset;
		}
	}
	
	static setStartOffset(startOffset, element) {
		var selection = window.getSelection();
		// selection.removeAllRanges();
		let range = document.createRange(); // do not use new Range(), it will not be associated with document
		range.setStart(element, startOffset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
	}
	
	/*
	static getStartOffset() {
		var selection = window.getSelection();
		if ( selection.getRangeAt && selection.rangeCount ) {
			let range = selection.getRangeAt(0).cloneRange();
			let startOffset = range.startOffset;
			return startOffset;
		}
	}
	
	static setStartOffset(startOffset, element) {
		var selection = window.getSelection();
		// selection.removeAllRanges();
		let range = new Range();
		range.setStart(element, startOffset);
		range.setEnd(element, startOffset);
		selection.addRange(range);
	}
	*/
}

// This line not optional. Content loads top to bottom. Need to wait until DOM is fully loaded.
window.addEventListener('DOMContentLoaded', (e) => {
	let analyze = document.getElementById('analyze');
	let json = document.getElementById('json');
	let richText = document.getElementById('rich-text');
	
	// load filter tests into textarea, to be our defaults
	let xmlhttp = new XMLHttpRequest();
	xmlhttp.open('GET', 'test-good-filters.txt', false);
	xmlhttp.send();
	let text = xmlhttp.responseText + "\n\n";
	
	/*
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open('GET', 'test-bad-filters.txt', false);
	xmlhttp.send();
	text += xmlhttp.responseText;
	*/
	
	richText.innerHTML = text;
	
	richText.addEventListener('input', function(e) {
		// In theory, we should need some escapeHTML's and unescapeHTML's around here. In actual testing, anything being written into the <textarea> by JS didn't need to be escaped.
		let startOffset = Helper.getStartOffset();
		let block = new AdBlockSyntaxBlock();
		block.parseRichText(richText.innerHTML);
		json.value = block.json;
		richText.innerHTML = block.richText;
		Helper.setStartOffset(startOffset, richText);
		richText.focus(); // blinks the cursor
	});
	
	// When pasting into rich text editor, force plain text. Do not allow rich text or HTML. For example, the default copy/paste from VS Code is rich text. The formatting overrides our syntax highlighting.
	richText.addEventListener("paste", function(e) {
		// cancel paste
		e.preventDefault();
		// get text representation of clipboard
		var text = (e.originalEvent || e).clipboardData.getData('text/plain');
		// insert text manually
		document.execCommand("insertHTML", false, text);
		richText.focus(); // blinks the cursor
	});
	
	richText.dispatchEvent(new Event('input', { bubbles: true }));
});