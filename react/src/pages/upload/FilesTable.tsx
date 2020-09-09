import React from 'react'
import { makeStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import MaterialTable, { MTableToolbar } from 'material-table';
import { useState, useEffect } from 'react';

const useStyles = makeStyles(theme => ({
    chip: {
        color: "primary",
        marginRight: '10px',
        colorPrimary: theme.palette.primary,
    }
}));


function createFile(object_name: string, owner_id: string, size: number, etag: string, last_modified : string) {
    return { object_name, owner_id, size, etag, last_modified };
}


export default function FilesTable() {
    const classes = useStyles();

    const [data, setData] = useState([createFile(
        'TESTER.fastq.gz', 'CHEO', 6611, '3a72eed94ddd4fafff9e4c2ba88cae02', '2020-09-01'
        )]);

    //for error handling (?)
    const [iserror, setIserror] = useState(false)
    const [errorMessages, setErrorMessages] = useState([''])


    useEffect(() => {
        fetch("/api/objects").then(res => res.json()).then(res => {
            setData(res);
          })

          // not entirely sure how this works 
          .catch(error=>{
            setErrorMessages(["Error..."])
            setIserror(true)
          })
      }, [])
    

    return (
        <MaterialTable
            // fields need to be identical to json keys
            columns={[
                { title: 'File name', field: 'object_name' },
                { title: 'Uploader', field: 'owner_name' },
                { title: 'Bucket Name', field: 'bucket_name' },
                { title: 'Size (mb)', field: 'size', type: 'numeric' },
                { title: 'etag', field: 'etag', type: 'string' },
                { title: 'Last Modified', field: 'last_modified', type: 'string' }
            ]}
            data={data}
            title="Unlinked files"
            options={{
                pageSize: 5,
                selection: true
            }}
            components={{
                Toolbar: props => (
                    <div>
                        <MTableToolbar {...props} />
                        <div style={{ marginLeft: '24px' }}>
                            <Chip label="CHEO" clickable className={classes.chip} />
                            <Chip label="SK" clickable className={classes.chip} />
                            <Chip label="ACH" clickable className={classes.chip} />
                            <Chip label="BCL" clickable className={classes.chip} />
                            <Chip label="Misc." clickable className={classes.chip} />
                        </div>
                    </div>
                ),
            }}
        />
    )
}
