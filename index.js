const express = require('express')
const app = express()
const mongoos = require('mongoose')
const cors = require('cors');
const Razorpay = require('razorpay')
require('dotenv').config()

app.use(cors({
    "origin": "http://localhost:3000",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": true,
    "optionsSuccessStatus": 204
}));
app.use(express.json());

mongoos.connect('mongodb://localhost:27017/zomato').then(() => {
    app.listen(process.env.CYCLIC_URL || 2000, (err) => err ? console.log(`There is an error while running the server: ${err}`) : console.log(`Server is running on port number 2000...`))
}).catch(err => {
    console.log('Unable to connect to mongoDB...')
})


let resturentSchema = new mongoos.Schema({
    name: {
        type: String,
    },
    city: {
        type: String,
    },
    cuisine: [
        {
            type: {
                type: String,
            }
        }
    ],
    min_price: {
        type: Number,
    }
})



let mealTypeModule = mongoos.model('mealType', resturentSchema)

let resturentModule = mongoos.model('resturents', resturentSchema)


app.get('/mealtype', async (req, res) => {
    let allMealType = await mealTypeModule.find({}).catch(err => {
        res.header(500).json({ status: false, data: `Server error ${err}` })
    })
    if (allMealType.length !== 0) {
        res.header(200).json({ status: true, data: allMealType })
    } else {
        res.header(400).json({ status: false, data: "No data is available in the server" })
    }
})

app.get('/resturents', async (req, res) => {
    let { location } = req.query
    let resturentListAccordingToLocation = await resturentModule.find({ city: location }).catch(err => {
        res.header(400).json({ status: false, data: err })
        return;
    })
    if (resturentListAccordingToLocation.length == 0) {

        res.header(400).json({ status: false, data: 'No restaturent found at this location' })
        return;
    }
    let sortedResturentDetails = resturentListAccordingToLocation.map(data => {
        return {
            id: data._id,
            name: data.name,
            city: data.city
        }
    })
    res.header(200).json({ status: true, data: sortedResturentDetails })
})


app.get('/resturent/:id', async (req, res) => {
    let resturentListAccordingToLocation = await resturentModule.findById(req.params.id).catch(err => {
        res.header(400).json({ status: false, data: err })
    })

    res.header(200).json({ status: true, data: resturentListAccordingToLocation })
})


app.get('/location', async (req, res) => {
    let data = await resturentModule.find({})
    let locations = data.map((item) => {
        return item.city.toLocaleLowerCase()
    })
    let city = [...new Set(locations)]
    res.header(200).json({ status: true, data: city })
})

app.get('/resturents/filter', async (req, res) => {
    let { skip, cusine, location, costMax_Min, sortHigh_Low } = req.query
    skip = parseInt(skip)

    let filterObject = {}
    // Check location if it's value is undefined or not
    if (location !== '') {
        filterObject = {
            city: location,
        }
    }


    // Check cusine if it's value is undefined or not
    if (cusine !== 'undefined' && cusine) {
        cusine = cusine.split(',')
        filterObject.cuisine = {
            $elemMatch: { name: { $in: cusine } }
        }
    }
    // Check costMax_Min if it's value is undefined or not
    if (costMax_Min !== 'undefined') {
        costMax_Min = JSON.parse(costMax_Min)
        filterObject.min_price = {
            $gte: costMax_Min.min,
            $lte: costMax_Min.max
        }
    }
    // Check sortHigh_Low if it's value is undefined or not
    if (sortHigh_Low !== 'undefined') {
        sortHigh_Low = parseInt(sortHigh_Low)

        const totalItem = await resturentModule.find(filterObject).sort({ min_price: sortHigh_Low }).countDocuments()
        if (totalItem === 0) {
            return res.header(400).json({ status: false, data: "No result found to satisfy the search request..." })
        }
        const restaturentData = await resturentModule.find(filterObject).sort({ min_price: sortHigh_Low }).skip(skip * 10).limit(10)
        return res.header(200).json({ status: true, data: { totalItem, restaturentData } })
    }
    const totalItem = await resturentModule.find(filterObject).countDocuments()
    if (totalItem === 0) {
        return res.header(400).json({ status: false, data: "No result found to satisfy the search request..." })
    }
    const restaturentData = await resturentModule.find(filterObject).skip(skip).limit(10)

    res.header(200).json({ status: true, data: { totalItem, restaturentData } })
})

const rezorPay = new Razorpay({
    key_id: 'rzp_test_IG9jeB32X4c02g',
    key_secret: 'eTpFIL7Jkw36x8JUCU9p1KXc',
})


app.post('/money', async (req, res) => {
    const options = {
        amount: req.body.amount * 10,
        currency: 'INR',
    }
    try {
        const response = await rezorPay.orders.create(options);
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
})