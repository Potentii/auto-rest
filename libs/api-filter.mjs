/**
 * @template T
 */
export default class ApiFilter {
	/**
	 * @type {string}
	 */
	filterName;
	/**
	 * @type {(value:*, item:T, index:number,items:T[]) => boolean}
	 */
	filterFn;



	/**
	 *
	 * @param {string} filterName
	 * @param {(value:*, item:T, index:number, items:T[]) => boolean} [filterFn]
	 */
	constructor(filterName, filterFn = item => true) {
		this.filterName = filterName;
		this.filterFn = filterFn;
	}

}