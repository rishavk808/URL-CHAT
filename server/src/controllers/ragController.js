export const ingestUrl = async (req,res) => {
    try{
        const {url} = req.body;
        if(!url || typeofurl !== 'string' || !url.trim()){
            return res.status(400).json({
                error: 'A valid URL string is required.'
            });
        }

        let validateUrl = url.trim();
        if(!validateUrl.startsWith('http://')) && !validatedUrl.startsWith('https://')){
            validateUrl = `http://${validateUrl}`;
        }
    }
}