import { toOptionViews, toRubricViews } from '../plain';

/**
 * These exist for one reason: an entry that reaches a Client Component
 * carrying a Mongoose ObjectId crashes the render. So the property worth
 * pinning is that the output holds exactly the declared fields and nothing
 * else - not merely that the values came through.
 *
 * The inputs below are shaped like what lean() returns: the declared fields
 * plus the _id Mongoose adds to every inline subdocument.
 */

/** Stands in for an ObjectId: an object that is not a plain value. */
class FakeObjectId {
  constructor(private readonly value: string) {}
  toJSON() {
    return this.value;
  }
  toString() {
    return this.value;
  }
}

describe('toRubricViews', () => {
  it('drops the subdocument id Mongoose adds', () => {
    const fromDb = [
      { marks: 1, criterion: 'States the formula', _id: new FakeObjectId('a1') },
      { marks: 2, criterion: 'Substitutes correctly', _id: new FakeObjectId('a2') },
    ];

    const result = toRubricViews(fromDb);

    expect(result).toEqual([
      { marks: 1, criterion: 'States the formula' },
      { marks: 2, criterion: 'Substitutes correctly' },
    ]);
    // The assertion that matters: no key beyond the two declared.
    for (const entry of result) {
      expect(Object.keys(entry).sort()).toEqual(['criterion', 'marks']);
    }
  });

  it('survives a missing or empty rubric, which auto-marked questions have', () => {
    expect(toRubricViews(undefined)).toEqual([]);
    expect(toRubricViews(null)).toEqual([]);
    expect(toRubricViews([])).toEqual([]);
  });

  it('fills a gap rather than emitting undefined into a prop', () => {
    expect(toRubricViews([{ marks: undefined, criterion: undefined }])).toEqual([
      { marks: 0, criterion: '' },
    ]);
  });
});

describe('toOptionViews', () => {
  it('drops the subdocument id', () => {
    // Bound to a variable first, as a lean() result is in the services. Passed
    // inline, TypeScript's excess property check would reject the _id at
    // compile time - which is exactly why it never caught the real bug.
    const fromDb = [
      { key: 'A', text: '9.8 m/s^2', _id: new FakeObjectId('b1') },
      { key: 'B', text: '10 m/s^2', _id: new FakeObjectId('b2') },
    ];

    const result = toOptionViews(fromDb);

    expect(result).toEqual([
      { key: 'A', text: '9.8 m/s^2' },
      { key: 'B', text: '10 m/s^2' },
    ]);
    for (const option of result) {
      expect(Object.keys(option).sort()).toEqual(['key', 'text']);
    }
  });

  it('survives the empty options a non-multiple-choice question carries', () => {
    expect(toOptionViews(undefined)).toEqual([]);
    expect(toOptionViews([])).toEqual([]);
  });
});
