// Use AV.Cloud.define to define as many cloud functions as you want.
// For example:
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var _ = require('underscore');
var fs = require('fs');


var ContextLoader = function (appId, appKey) {
    this.AV = null;
    this.runInThis = function (script) {
        eval(this.script);
        this.AV.initialize(appId, appKey);
    }
    this.loadContext = function (appId, appKey) {
        var code = fs.readFileSync('cloud/av.js', {encoding: 'utf8'});
        this.script = code;
        this.runInThis.call(this);
    }
    this.loadContext(appId, appKey);
}


/*func1().then(function(result1){
    return func2(result1);
}).then(function(result2){
    return func3(result2)
}).done(function(final){

})

var func1 = function(){
    ...
    return request()
}*/

// input "websiteUrl" to crawling the  website and callback its websiteBody
var crawlingWebsite = function(websiteUrl,callback){
        websiteUrl="http://www.producthunt.com/";
    request({url: websiteUrl, method: 'GET', headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.8',
    'Cache-Control': 'max-age=0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.137 Safari/537.36 LBBROWSER'
}}, function (error, response, body) {

    if (!error && response.statusCode == 200) {
       // var $ = cheerio.load(body.toString());
      //  console.log(response);
        callback(null,body);
    }
    else{
            console.log("error1");
        callback(error,response);
        }
});

};
//input "websiteBody"  to parse the DOM  and callback structured data
var parsePHDomToGetInfo = function(websiteDom,callback){


    var $ = cheerio.load(websiteDom.toString());

    var proDataList = [];
      $('.day .posts-group .post ').each(function () {
        var $title = $(this).find('.url a');
        var $day = $(this).parent().prev();
        var $vote = $(this).find('.upvote span');
        var $comment = $(this).find('.view-discussion p');
        var update = new Date().getTime();
        var $description = $(this).find('.url span');
        var item = {
            productName: $title.text().trim(),
            productUrl: "http://www.producthunt.com" + $title.attr('href'),
            productDay: $day.attr('datetime'),
            productVote: $vote.text().trim(),
            updateTime: update,
            productComment: $comment.text().trim(),
            productDescription: $description.text().trim()
        };
        var t = item.productUrl.match(/l\/([a-zA-Z0-9]+)/);
        //     console.log(t);
        if (Array.isArray(t)) {
            item.productId = t[1];
        }
          proDataList.push(item);

    });

    callback(null,proDataList)


}
//need this ??input an object of products data ,convert  redirected url and output the object
var convertRedirectedUrl = function(proDataList,callback){
   var  productSet=proDataList

    //.log('SuccessfulGetProductSet!!!!!-No:' + productSet.length);
    var i = 0;
    async.each(productSet, function (query, next) {
        request({url: query.productUrl, followRedirect: false}, function (error, response, body) {
            // console.log(query);
            if (error) {

                console.log(query);
                //  console.log(response);
                console.log(error + "  qqq   " + response);
            }
            if (!error) {
                if (response) {
                    // console.log(response);
                    //     console.log("resStat:" + response.statusCode + "-" + "Host:" + response.headers.location + "   " + i++);
                    query.productUrl = response.headers.location;
                }
                else {
                    console.log(query.productUrl);
                    console.log("No response!!! Timeout!!");
                }
            }
            next();
        });

    }, function (err) {
        if (err) {
            console.log(err + "productSet Here");
            callback(err,productSet)
        }
      else{
            callback(null,productSet)

        }//  console.log(" Successfully Get Redirecting Url ");

    });


}
//input lists of  object , store the info to database and output nothing
var storePHDataToDatabase = function(productSet,callback){
    var techhackLoader =new ContextLoader('xv1cgfapsn90hyy2a42i9q6jg7phbfmdpt1404li6n93tt2r','70sp4h8prccxzyfp56vwm9ksczji36bsrjvtwzvrzegfza67')

  //  var BV = require('avoscloud-sdk').AV;
  //  BV.initialize("xv1cgfapsn90hyy2a42i9q6jg7phbfmdpt1404li6n93tt2r", "70sp4h8prccxzyfp56vwm9ksczji36bsrjvtwzvrzegfza67");
    var Product = techhackLoader.AV.Object.extend("Product");
    var ProductDetail = techhackLoader.AV.Object.extend("ProductDetail");
    var ProductState = techhackLoader.AV.Object.extend("ProductState");
    var i = 0;
    _.each(productSet, function (apiProduct) {
        var product = new Product();
        var productDetail = new ProductDetail();
        var productState = new ProductState();
        var queryList = new techhackLoader.AV.Query(Product);
        var queryDetail = new techhackLoader.AV.Query(ProductDetail);
        var queryState = new techhackLoader.AV.Query(ProductState);
        async.waterfall([
                function (callback) {
                    queryList.equalTo("pid", apiProduct.productId);
                    queryList.find({
                        success: function (resProduct) {

                            var len = resProduct.length;
                            //   console.log(len + "++" + (++i));
                            if (len == 1) {
                                //      console.log("productDetail!!" + apiProduct.productId);
                                apiProduct.productRoot = resProduct[0];
                            }
                            callback(null, len);
                        }
                    });
                }
                , function (len, callback) {
                    if (len == 0) {
                        //      console.log("Not Existing in  List!!" + apiProduct.productId)
                        product.set("source", "producthunt.com");
                        product.set("name", apiProduct.productName);
                        product.set("website", apiProduct.productUrl);
                        product.set("pid", apiProduct.productId);
                        product.save().then(function (rootProduct) {
                            apiProduct.productRoot = rootProduct;
                            callback(null);
                        });
                    }
                    else if (len == 1) {

                        callback(null);
                    }
                    else if (len > 1) {
                        console.log("Error!!!!!!!!!!!!!!!!!!!Return Exists No:" + len);
                        callback(null);
                    }
                }
                , function (callback) {
                    console.log("Successfully update product !")
                    queryDetail.equalTo("product", apiProduct.productRoot);
                    queryDetail.find({
                        success: function (resProduct) {
                            var len = resProduct.length;
                            // console.log("productDetail: " + len + "-------------"  + (--i));

                            if (len == 1) {
                                //      console.log("Exists in Detail !!!");
                            }

                            callback(null, len);
                        }
                    });

                }
                , function (len, callback) {
                    if (len == 0) {
                        productDetail.set("source", "producthunt.com");
                        productDetail.set("name", apiProduct.productName);
                        productDetail.set("website", apiProduct.productUrl);
                        productDetail.set("birth", apiProduct.productDay);
                        productDetail.set("description", apiProduct.productDescription);
                        productDetail.set("product", apiProduct.productRoot);
                        productDetail.save().then(function () {
                            callback(null);
                        });

                    }

                    else if (len == 1) {

                        callback(null);
                    }
                    else if (len > 1) {
                        callback(null);

                    }
                }

                , function (callback) {
                 //   console.log("Successfully update productDetail !")

                    //  console.log("State Return NotExists ");
                    productState.set("source", "producthunt.com");
                    productState.set("product", apiProduct.productRoot);
                    productState.set("voteCount", apiProduct.productVote);
                    //   productState.add("updateTime", apiProduct.updateTime);
                    productState.set("commentCount", apiProduct.productComment);

                    productState.save().then(function () {
                            callback(null);
                        }, function (error) {
                            if (error)  console.log(error);
                        }
                    );
                }]
            , function (error) {
                if (error)  console.log(error);
            });
    }
        ,   function (error) {
        if (error) {
            console.log(error);
            callback(error)
        }
       else{
            console.log("Successfully storePHDataToDatabase inner !")

            callback(null);

        }
    });
}


AV.Cloud.define("crawelerForPH",function(req,res){
    async.waterfall([
        function(callback){
         crawlingWebsite("",function(err,websiteDom){
             if(err){
                 console.log(err)
                 callback(err,null)

             }
             else{
                 console.log("success crawlingWebsite");

                 callback(null,websiteDom)

             }
         })
        }
        ,function(websiteDom,callback){
           parsePHDomToGetInfo(websiteDom,function(err,proDataList){
               if(err){
                   console.log(err)
                   callback(err,null)

               }
               else{
                   console.log("success parsePHDomToGetInfo");

                   callback(null,proDataList)

               }
           })
        }
       ,function(proDataList,callback) {
           convertRedirectedUrl(proDataList,function(err,productSet){
               if(err){
                   console.log(err)
                   callback(err,null)

               }
               else{
                   console.log("Successfully convertRedirectedUrl  !")

                   callback(null,productSet)

               }
           })
        }
        ,function(productSet,callback) {
            console.log("jjjjjjjjjjjjjjsjsididi")
            storePHDataToDatabase(productSet, function (err) {
                if (err) {
                    console.log(err)
                    callback(err, null)

                }
                else {
                    console.log("Successfully storePHDataToDatabase !")

                    callback(null)

                }
            })
        }
    ],function(err){
        if(err){
            console.log(err)
            res.error(err)
        }
        else{
            console.log("Successfully finish crawelerForPH !")

            res.success("Nice all!")
        }
    })

})

AV.Cloud.run("crawelerForPH", {}, {
    success: function(data){
        //调用成功，得到成功的应答data
        console.log(data);
    },
    error: function(err){
        //处理调用失败
        console.log(err)
    }
});