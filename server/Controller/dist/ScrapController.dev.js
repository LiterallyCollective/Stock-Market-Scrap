"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var ObjectId = require('mongodb').ObjectID;

var _require = require('node-cron'),
    schedule = _require.schedule;

var axios = require("axios");

var ScrapController =
/*#__PURE__*/
function () {
  function ScrapController(db) {
    _classCallCheck(this, ScrapController);

    this.db = db;
  }

  _createClass(ScrapController, [{
    key: "UpdateTotal",
    value: function UpdateTotal() {
      return regeneratorRuntime.async(function UpdateTotal$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return regeneratorRuntime.awrap(this.GetTags());

            case 2:
              _context.next = 4;
              return regeneratorRuntime.awrap(this.GetCompaniesTimeSeries());

            case 4:
              _context.next = 6;
              return regeneratorRuntime.awrap(this.CalculateData());

            case 6:
            case "end":
              return _context.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: "ReadCompanies",
    value: function ReadCompanies(_ref) {
      var _ref$str_query, str_query, _ref$skip, skip, _ref$limit, limit, regex, companies, result;

      return regeneratorRuntime.async(function ReadCompanies$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _ref$str_query = _ref.str_query, str_query = _ref$str_query === void 0 ? '' : _ref$str_query, _ref$skip = _ref.skip, skip = _ref$skip === void 0 ? 0 : _ref$skip, _ref$limit = _ref.limit, limit = _ref$limit === void 0 ? 10 : _ref$limit;
              regex = "";
              regex = ".*" + str_query + ".*";
              console.log("regex", regex, str_query, skip, limit);
              _context2.next = 6;
              return regeneratorRuntime.awrap(this.db.collection('companies').find({
                "name": {
                  $regex: regex
                }
              }).toArray());

            case 6:
              companies = _context2.sent;
              _context2.next = 9;
              return regeneratorRuntime.awrap(this.db.collection('companies').aggregate([
              /*{
                  $lookup: {
                      from: "tags",
                      localField: "tag_key",
                      foreignField: "_id",
                      as: "tag"
                  }
              },
              {
                  $unwind: "$tag"
              },*/
              {
                $match: {
                  "name": {
                    $regex: regex
                  }
                }
              }, {
                $skip: skip
              }, {
                $limit: limit
              }, {
                $lookup: {
                  from: "analysis_result",
                  "let": {
                    company_id: "$_id"
                  },
                  pipeline: [{
                    $match: {
                      $expr: {
                        $and: [{
                          $eq: ["$company_id", "$$company_id"]
                        }]
                      }
                    }
                  }, {
                    $sort: {
                      "created_at": -1
                    }
                  }, {
                    $limit: 1
                  }],
                  as: "analysis_result"
                }
              }
              /*{
                  $unwind: "$analysis_result"
              },*/
              ]).toArray());

            case 9:
              result = _context2.sent;
              console.log('read companies', result.length);
              return _context2.abrupt("return", {
                total_count: companies.length,
                result: result
              });

            case 12:
            case "end":
              return _context2.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: "GetAnalysis",
    value: function GetAnalysis(data) {
      var company_detail, series, rsp, psp, rsi, tp, sl, bollinger_band, drawdown, current_price, current_high, current_low, max_price, min_price, layer, price_movement;
      return regeneratorRuntime.async(function GetAnalysis$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              //console.log(data)
              data.days = parseInt(data.days);
              _context3.next = 3;
              return regeneratorRuntime.awrap(this.db.collection('companies').findOne({
                _id: data.company_id
              }));

            case 3:
              company_detail = _context3.sent;
              _context3.next = 6;
              return regeneratorRuntime.awrap(this.db.collection('series').aggregate([{
                $match: {
                  company_id: data.company_id
                }
              }, {
                $sort: {
                  "dateTime": -1
                }
              }, {
                $limit: data.days
              }, {
                $sort: {
                  "dateTime": 1
                }
              }]).toArray());

            case 6:
              series = _context3.sent;
              rsp = 0;
              psp = 0;
              rsi = 0;
              tp = 0;
              sl = 0;
              bollinger_band = 0;
              drawdown = 0;

              try {
                current_price = series[series.length - 1].close;
                current_high = series[series.length - 1].high;
                current_low = series[series.length - 1].low;
                rsp = (100 - (current_price - series[0].close) / series[0].close * 100).toFixed(2);
                psp = series[0].close;
                max_price = Math.max.apply(Math, series.map(function (o) {
                  return o.close;
                }));
                min_price = Math.min.apply(Math, series.map(function (o) {
                  return o.close;
                }));
                layer = (max_price - min_price) / 6;
                price_movement = current_price - (min_price + layer * 3);
                bollinger_band = price_movement / layer;
                drawdown = (max_price - min_price) / series[0].close * 100; // let high_avg=series.map(x=>x.high).reduce(function(a, b){return a+b;})
                // let low_avg=series.map(x=>x.low).reduce(function(a, b){return a+b;})
                // rsi=100-(100/(1+(high_avg-current_high)/(low_avg-current_low)))

                rsi = 100 + (current_price - series[0].close) / series[0].close * 100;
                tp = max_price + layer * 5.5;
                sl = max_price + layer * 0.5; //console.log(max_price,min_price,high_avg,low_avg)
              } catch (e) {
                console.log("*** GetAnalysis: ERROR ***");
              }

              return _context3.abrupt("return", {
                company_detail: company_detail,
                series: series,
                rsp: rsp,
                bollinger_band: bollinger_band.toFixed(2),
                drawdown: drawdown.toFixed(2),
                rsi: rsi.toFixed(2),
                tp: tp.toFixed(2),
                sl: sl.toFixed(2),
                psp: psp.toFixed(2),
                tp_sl: (tp / sl).toFixed(2)
              });

            case 16:
            case "end":
              return _context3.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: "GetAnalysisByDate",
    value: function GetAnalysisByDate(company_id) {
      var days, result, analysis_result, _i, _days, day, temp, series, updated_at;

      return regeneratorRuntime.async(function GetAnalysisByDate$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              days = [1, 3, 7, 14, 28, 60, 90];
              result = [];
              analysis_result = {};
              _i = 0, _days = days;

            case 4:
              if (!(_i < _days.length)) {
                _context4.next = 17;
                break;
              }

              day = _days[_i];
              _context4.next = 8;
              return regeneratorRuntime.awrap(this.GetAnalysis({
                company_id: company_id,
                days: day
              }));

            case 8:
              temp = _context4.sent;
              temp.days = day;
              result.push(temp); // delete temp.company_detail

              delete temp.series;
              delete temp.company_detail;
              analysis_result["day_" + day] = temp;

            case 14:
              _i++;
              _context4.next = 4;
              break;

            case 17:
              _context4.prev = 17;
              _context4.next = 20;
              return regeneratorRuntime.awrap(this.db.collection('series').aggregate([{
                $match: {
                  company_id: company_id
                }
              }, {
                $sort: {
                  "dateTime": -1
                }
              }, {
                $limit: 1
              }, {
                $sort: {
                  "dateTime": -1
                }
              }]).toArray());

            case 20:
              series = _context4.sent;
              updated_at = "";

              if (series.length > 0) {
                updated_at = series[0].dateTime_str;
              }

              console.log('updated_at', updated_at);
              /*this.db.collection("companies").updateOne({_id: company_id}, {
                  $set: {
                      // analysis_result: analysis_result,
                      updated_at
                  }
              })*/

              _context4.next = 26;
              return regeneratorRuntime.awrap(this.db.collection("analysis_result").updateOne({
                _id: company_id + '_' + updated_at
              }, {
                $set: {
                  analysis_result: analysis_result,
                  updated_at: updated_at,
                  current_stock: series[0],
                  created_at: new Date().toISOString(),
                  company_id: company_id
                }
              }, {
                upsert: true
              }));

            case 26:
              _context4.next = 31;
              break;

            case 28:
              _context4.prev = 28;
              _context4.t0 = _context4["catch"](17);
              console.log("***GetAnalysisByDate ***", company_id, _context4.t0);

            case 31:
              return _context4.abrupt("return", result);

            case 32:
            case "end":
              return _context4.stop();
          }
        }
      }, null, this, [[17, 28]]);
    }
  }, {
    key: "CalculateData",
    value: function CalculateData() {
      var _this = this;

      var companies;
      return regeneratorRuntime.async(function CalculateData$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.next = 2;
              return regeneratorRuntime.awrap(this.db.collection('companies').find().toArray());

            case 2:
              companies = _context6.sent;
              console.log("CalculateData START");
              companies.forEach(function _callee(company) {
                return regeneratorRuntime.async(function _callee$(_context5) {
                  while (1) {
                    switch (_context5.prev = _context5.next) {
                      case 0:
                        _context5.next = 2;
                        return regeneratorRuntime.awrap(_this.GetAnalysisByDate(company._id)["catch"](function (e) {
                          console.log("*** CalculateData: ERROR ****", e);
                        }));

                      case 2:
                      case "end":
                        return _context5.stop();
                    }
                  }
                });
              });
              console.log("---- CalculateData COMPLETE ----");
              return _context6.abrupt("return", 0);

            case 7:
            case "end":
              return _context6.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: "GetCompaniesTimeSeries",
    value: function GetCompaniesTimeSeries() {
      var _this2 = this;

      var companies, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _loop, _iterator, _step;

      return regeneratorRuntime.async(function GetCompaniesTimeSeries$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              _context8.next = 2;
              return regeneratorRuntime.awrap(this.db.collection('companies').find().toArray());

            case 2:
              companies = _context8.sent;
              console.log("GetCompaniesTimeSeries Scrapping", companies.length);
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context8.prev = 7;

              _loop = function _loop() {
                var company, url, result, series, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, item;

                return regeneratorRuntime.async(function _loop$(_context7) {
                  while (1) {
                    switch (_context7.prev = _context7.next) {
                      case 0:
                        company = _step.value;
                        _context7.prev = 1;
                        url = "https://api.shikiho.jp/timeseries/v1/timeseries/1/".concat(company._id, "?term=36m&addtionalFields=volume%2CsellMargin%2CbuyMargin&format=epocmilli&market=prime&cycle=d");
                        _context7.next = 5;
                        return regeneratorRuntime.awrap(axios.get(url, {
                          headers: {
                            "authorization": "clie5aezWyjER92iNgJb0XPMXnDvBpp1Ad5W"
                          }
                        })["catch"](function (e) {
                          console.log("Series scrapping error", company._id);
                        }));

                      case 5:
                        result = _context7.sent;
                        series = result.data.series;
                        _iteratorNormalCompletion2 = true;
                        _didIteratorError2 = false;
                        _iteratorError2 = undefined;
                        _context7.prev = 10;
                        _iterator2 = series[Symbol.iterator]();

                      case 12:
                        if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                          _context7.next = 21;
                          break;
                        }

                        item = _step2.value;
                        item._id = company._id + "_" + item.dateTime_str;
                        item.company_id = company._id;
                        _context7.next = 18;
                        return regeneratorRuntime.awrap(_this2.db.collection("series").updateOne({
                          _id: item._id
                        }, {
                          $set: item
                        }, {
                          upsert: true
                        }));

                      case 18:
                        _iteratorNormalCompletion2 = true;
                        _context7.next = 12;
                        break;

                      case 21:
                        _context7.next = 27;
                        break;

                      case 23:
                        _context7.prev = 23;
                        _context7.t0 = _context7["catch"](10);
                        _didIteratorError2 = true;
                        _iteratorError2 = _context7.t0;

                      case 27:
                        _context7.prev = 27;
                        _context7.prev = 28;

                        if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
                          _iterator2["return"]();
                        }

                      case 30:
                        _context7.prev = 30;

                        if (!_didIteratorError2) {
                          _context7.next = 33;
                          break;
                        }

                        throw _iteratorError2;

                      case 33:
                        return _context7.finish(30);

                      case 34:
                        return _context7.finish(27);

                      case 35:
                        _context7.next = 40;
                        break;

                      case 37:
                        _context7.prev = 37;
                        _context7.t1 = _context7["catch"](1);
                        console.log("*** GetCompaniesTimeSeries ID: ".concat(company._id, ": ERROR ***"));

                      case 40:
                      case "end":
                        return _context7.stop();
                    }
                  }
                }, null, null, [[1, 37], [10, 23, 27, 35], [28,, 30, 34]]);
              };

              _iterator = companies[Symbol.iterator]();

            case 10:
              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                _context8.next = 16;
                break;
              }

              _context8.next = 13;
              return regeneratorRuntime.awrap(_loop());

            case 13:
              _iteratorNormalCompletion = true;
              _context8.next = 10;
              break;

            case 16:
              _context8.next = 22;
              break;

            case 18:
              _context8.prev = 18;
              _context8.t0 = _context8["catch"](7);
              _didIteratorError = true;
              _iteratorError = _context8.t0;

            case 22:
              _context8.prev = 22;
              _context8.prev = 23;

              if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                _iterator["return"]();
              }

            case 25:
              _context8.prev = 25;

              if (!_didIteratorError) {
                _context8.next = 28;
                break;
              }

              throw _iteratorError;

            case 28:
              return _context8.finish(25);

            case 29:
              return _context8.finish(22);

            case 30:
              console.log("---- GetCompaniesTimeSeries Scrapping : COMPLETE ----", companies.length);
              return _context8.abrupt("return", 0);

            case 32:
            case "end":
              return _context8.stop();
          }
        }
      }, null, this, [[7, 18, 22, 30], [23,, 25, 29]]);
    }
  }, {
    key: "GetTags",
    value: function GetTags() {
      var url, tags, tag_data, key, temp;
      return regeneratorRuntime.async(function GetTags$(_context9) {
        while (1) {
          switch (_context9.prev = _context9.next) {
            case 0:
              console.log("tags scraping");
              _context9.prev = 1;
              url = "https://api.shikiho.jp/screening/v1/headwords/count";
              _context9.next = 5;
              return regeneratorRuntime.awrap(axios.get(url, {
                headers: {
                  "authorization": "709e14b2b9fdba0e93c5171bc7dcdbd5"
                }
              }));

            case 5:
              tags = _context9.sent;
              tag_data = tags.data.headwords;
              _context9.t0 = regeneratorRuntime.keys(tag_data);

            case 8:
              if ((_context9.t1 = _context9.t0()).done) {
                _context9.next = 18;
                break;
              }

              key = _context9.t1.value;
              //console.log(tag_data[key]);
              temp = tag_data[key];
              temp._id = key;
              _context9.next = 14;
              return regeneratorRuntime.awrap(this.db.collection("tags").updateOne({
                _id: temp._id
              }, {
                $set: temp
              }, {
                upsert: true
              }));

            case 14:
              _context9.next = 16;
              return regeneratorRuntime.awrap(this.GetCompaniesByTag(key));

            case 16:
              _context9.next = 8;
              break;

            case 18:
              _context9.next = 23;
              break;

            case 20:
              _context9.prev = 20;
              _context9.t2 = _context9["catch"](1);
              console.log("*** GetTags: ERROR ***");

            case 23:
            case "end":
              return _context9.stop();
          }
        }
      }, null, this, [[1, 20]]);
    }
  }, {
    key: "GetCompaniesByTag",
    value: function GetCompaniesByTag(tag_key) {
      var url, api_result, result, item;
      return regeneratorRuntime.async(function GetCompaniesByTag$(_context10) {
        while (1) {
          switch (_context10.prev = _context10.next) {
            case 0:
              _context10.prev = 0;
              url = "https://api.shikiho.jp/screening/v1/headwords?headword=".concat(tag_key);
              _context10.next = 4;
              return regeneratorRuntime.awrap(axios.get(url, {
                headers: {
                  "authorization": "709e14b2b9fdba0e93c5171bc7dcdbd5"
                }
              }));

            case 4:
              api_result = _context10.sent;
              _context10.next = 7;
              return regeneratorRuntime.awrap(api_result.data.result);

            case 7:
              result = _context10.sent;
              _context10.t0 = regeneratorRuntime.keys(result);

            case 9:
              if ((_context10.t1 = _context10.t0()).done) {
                _context10.next = 15;
                break;
              }

              item = _context10.t1.value;
              _context10.next = 13;
              return regeneratorRuntime.awrap(this.db.collection('company_tag').updateOne({
                tag_key: tag_key,
                company_id: item.stockCode
              }, {
                $set: {
                  updated_at: new Date().toISOString()
                }
              }, {
                upsert: true
              }));

            case 13:
              _context10.next = 9;
              break;

            case 15:
              _context10.next = 20;
              break;

            case 17:
              _context10.prev = 17;
              _context10.t2 = _context10["catch"](0);
              console.log("*** GetCompaniesByTag: ERROR ***");

            case 20:
            case "end":
              return _context10.stop();
          }
        }
      }, null, this, [[0, 17]]);
    }
  }]);

  return ScrapController;
}();

module.exports = ScrapController;