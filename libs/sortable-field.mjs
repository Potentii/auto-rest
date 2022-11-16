/**
 * @template T
 */
export default class SortableField{
	/**
	 * @type {string}
	 */
	fieldName;
	/**
	 * @type {(item:T) => *}
	 */
	makeSortableFn;

	/**
	 *
	 * @param {string} fieldName
	 * @param {(item:T) => *} [makeSortableFn]
	 */
	constructor(fieldName, makeSortableFn = val => val) {
		this.fieldName = fieldName;
		this.makeSortableFn = makeSortableFn;
	}

}